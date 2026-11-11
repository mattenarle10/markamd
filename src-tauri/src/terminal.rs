use std::{collections::HashSet, path::Path, sync::Mutex};
use tauri::{Manager, State};

#[derive(Default)]
pub struct WaitSessions(pub Mutex<HashSet<String>>);

// Wait clients own a private temporary directory. Never accept arbitrary paths
// from the webview or command line as files to write or remove.
fn valid_marker(marker: &Path) -> bool {
    let Some(dir) = marker.parent() else {
        return false;
    };
    let Ok(temp) = std::env::temp_dir().canonicalize() else {
        return false;
    };
    if dir.parent() != Some(temp.as_path())
        || marker.file_name().is_none_or(|n| n != "session")
        || !dir
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with("marka-wait."))
    {
        return false;
    }
    let Ok(d) = std::fs::symlink_metadata(dir) else {
        return false;
    };
    let Ok(f) = std::fs::symlink_metadata(marker) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        if d.permissions().mode() & 0o077 != 0 || f.nlink() != 1 {
            return false;
        }
    }
    d.is_dir() && f.is_file() && !f.file_type().is_symlink()
}

pub fn register(state: &WaitSessions, marker: &str) {
    if valid_marker(Path::new(marker)) {
        state
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(marker.into());
    }
}

pub fn finish_all(state: &WaitSessions) {
    for marker in state.0.lock().unwrap_or_else(|e| e.into_inner()).drain() {
        if valid_marker(Path::new(&marker)) {
            let _ = std::fs::write(marker, "closed");
        }
    }
}

#[tauri::command]
pub fn acknowledge_wait_session(
    marker: String,
    state: State<'_, WaitSessions>,
) -> Result<(), String> {
    let sessions = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if sessions.contains(&marker) && valid_marker(Path::new(&marker)) {
        std::fs::write(marker, format!("opened:{}", std::process::id()))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn complete_wait_sessions(
    markers: Vec<String>,
    failed: Option<bool>,
    state: State<'_, WaitSessions>,
) -> Result<(), String> {
    let mut sessions = state.0.lock().unwrap_or_else(|e| e.into_inner());
    for marker in markers {
        if sessions.remove(&marker) && valid_marker(Path::new(&marker)) {
            std::fs::write(
                marker,
                if failed.unwrap_or(false) {
                    "failed"
                } else {
                    "closed"
                },
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installation {
    path: String,
}

#[cfg(target_os = "macos")]
fn install_link(target: &Path, destination: &Path) -> Result<(), String> {
    use std::os::unix::fs::symlink;
    if let Ok(meta) = std::fs::symlink_metadata(destination) {
        if !meta.file_type().is_symlink() {
            return Err(format!("refusing to replace {}", destination.display()));
        }
        let previous = std::fs::read_link(destination).map_err(|e| e.to_string())?;
        if previous == target {
            return Ok(());
        }
        // Only update an existing link into an official marka bundle.
        let app = previous
            .ancestors()
            .nth(4)
            .ok_or("unrecognized existing command")?;
        let expected = app.join("Contents/Resources/cli/marka");
        if previous != expected
            || !matches!(
                app.file_name().and_then(|n| n.to_str()),
                Some("marka.app" | "marka.md.app")
            )
        {
            return Err(format!("refusing to replace {}", destination.display()));
        }
        std::fs::remove_file(destination).map_err(|e| e.to_string())?;
    }
    symlink(target, destination).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn install_terminal_command(app: tauri::AppHandle) -> Result<Installation, String> {
    #[cfg(target_os = "macos")]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let bundle = exe.ancestors().nth(3).ok_or("cannot locate app bundle")?;
        let target = bundle.join("Contents/Resources/cli/marka");
        if !target.is_file() {
            return Err("install the bundled macOS app before installing the command".into());
        }
        let bin = app
            .path()
            .home_dir()
            .map_err(|e| e.to_string())?
            .join(".local/bin");
        std::fs::create_dir_all(&bin).map_err(|e| e.to_string())?;
        let destination = bin.join("marka");
        install_link(&target, &destination)?;
        Ok(Installation {
            path: destination.to_string_lossy().into_owned(),
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("the marka command is currently available on macOS".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_registered_private_sessions_complete_on_quit() {
        let marker = crate::wait_marker_path().unwrap();
        std::fs::write(&marker, "waiting").unwrap();
        let state = WaitSessions::default();
        register(&state, marker.to_str().unwrap());
        assert_eq!(state.0.lock().unwrap().len(), 1);
        finish_all(&state);
        assert_eq!(std::fs::read_to_string(&marker).unwrap(), "closed");
        assert!(state.0.lock().unwrap().is_empty());
        std::fs::remove_file(&marker).unwrap();
        std::fs::remove_dir(marker.parent().unwrap()).unwrap();
    }
    #[test]
    fn rejects_arbitrary_marker_paths() {
        assert!(!valid_marker(Path::new("/etc/hosts")));
        assert!(!valid_marker(Path::new("/tmp/marka-wait.other/session")));
    }
    #[cfg(target_os = "macos")]
    #[test]
    fn installer_preserves_unrelated_files_and_links() {
        let root = std::env::temp_dir().join(format!("marka-install-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let dest = root.join("marka");
        std::fs::write(&dest, "user command").unwrap();
        assert!(install_link(
            Path::new("/Applications/marka.app/Contents/Resources/cli/marka"),
            &dest
        )
        .is_err());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "user command");
        std::fs::remove_file(&dest).unwrap();
        std::os::unix::fs::symlink("/other/command", &dest).unwrap();
        assert!(install_link(
            Path::new("/Applications/marka.app/Contents/Resources/cli/marka"),
            &dest
        )
        .is_err());
        std::fs::remove_file(&dest).unwrap();
        let old = Path::new("/Applications/marka.md.app/Contents/Resources/cli/marka");
        let new = Path::new("/Applications/marka.app/Contents/Resources/cli/marka");
        install_link(old, &dest).unwrap();
        install_link(old, &dest).unwrap();
        install_link(new, &dest).unwrap();
        assert_eq!(std::fs::read_link(&dest).unwrap(), new);
        std::fs::remove_file(&dest).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
