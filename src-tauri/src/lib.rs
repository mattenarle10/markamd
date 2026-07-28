#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

use std::sync::Mutex;
use tauri::State;

// `Emitter` and `Manager` are used by both the single-instance callback (all
// platforms) and the macOS Finder open-with handler. `RunEvent::Opened` is
// macOS-only, so it stays gated.
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri::{Emitter, Manager};

const WAIT_FLAG: &str = "--wait";
const WAIT_OPEN_FLAG: &str = "--wait-open";

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenFileRequest {
    path: String,
    wait_marker: Option<String>,
}

struct PendingOpenFiles(Mutex<Vec<OpenFileRequest>>);

fn is_supported_markdown_path(path: &std::path::Path) -> bool {
    let Some(ext) = path.extension().and_then(|ext| ext.to_str()) else {
        return false;
    };
    path.is_file() && matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdx")
}

fn open_request_from_arg(
    arg: &std::ffi::OsStr,
    wait_marker: Option<String>,
) -> Option<OpenFileRequest> {
    let path = std::path::PathBuf::from(arg);
    if is_supported_markdown_path(&path) {
        Some(OpenFileRequest {
            path: path.to_string_lossy().to_string(),
            wait_marker,
        })
    } else {
        None
    }
}

fn open_requests_from_args<I, S>(args: I) -> Vec<OpenFileRequest>
where
    I: IntoIterator<Item = S>,
    S: Into<std::ffi::OsString>,
{
    let mut requests = Vec::new();
    let args: Vec<std::ffi::OsString> = args.into_iter().map(Into::into).collect();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if arg == WAIT_OPEN_FLAG {
            let marker = args
                .get(index + 1)
                .map(|value| value.to_string_lossy().to_string());
            if let (Some(marker), Some(path)) = (marker, args.get(index + 2)) {
                if let Some(request) = open_request_from_arg(path, Some(marker)) {
                    requests.push(request);
                }
            }
            index += 3;
            continue;
        }
        if arg == WAIT_FLAG {
            index += 2;
            continue;
        }
        if let Some(request) = open_request_from_arg(arg, None) {
            requests.push(request);
        }
        index += 1;
    }
    requests
}

fn initial_open_requests_from_args() -> Vec<OpenFileRequest> {
    open_requests_from_args(std::env::args_os().skip(1))
}

fn wait_marker_path() -> std::path::PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!("marka-wait-{}-{nanos}.marker", std::process::id()))
}

fn handle_wait_client() -> bool {
    let args: Vec<std::ffi::OsString> = std::env::args_os().skip(1).collect();
    let Some(wait_index) = args.iter().position(|arg| arg == WAIT_FLAG) else {
        return false;
    };
    let Some(path) = args.get(wait_index + 1) else {
        eprintln!("marka.md: --wait requires a markdown file path");
        std::process::exit(2);
    };
    let path = std::path::PathBuf::from(path);
    if !is_supported_markdown_path(&path) {
        eprintln!("marka.md: --wait only supports existing .md, .markdown, or .mdx files");
        std::process::exit(2);
    }

    let marker = wait_marker_path();
    if let Err(err) = std::fs::write(&marker, b"waiting") {
        eprintln!("marka.md: failed to create wait marker: {err}");
        std::process::exit(1);
    }

    let exe = match std::env::current_exe() {
        Ok(exe) => exe,
        Err(err) => {
            let _ = std::fs::remove_file(&marker);
            eprintln!("marka.md: failed to locate current executable: {err}");
            std::process::exit(1);
        }
    };
    if let Err(err) = std::process::Command::new(exe)
        .arg(WAIT_OPEN_FLAG)
        .arg(&marker)
        .arg(&path)
        .spawn()
    {
        let _ = std::fs::remove_file(&marker);
        eprintln!("marka.md: failed to launch marka.md: {err}");
        std::process::exit(1);
    }

    while marker.exists() {
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    true
}

#[tauri::command]
fn reveal_in_file_manager(path: String) {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let p = std::path::Path::new(&path);
    #[cfg(target_os = "windows")]
    {
        let target = if p.is_dir() {
            path.clone()
        } else {
            p.parent()
                .and_then(|d| d.to_str())
                .unwrap_or("")
                .to_string()
        };
        let _ = std::process::Command::new("explorer").arg(target).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .args(["-R", &path])
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let target = if p.is_dir() {
            p.to_str().unwrap_or("").to_string()
        } else {
            p.parent()
                .and_then(|d| d.to_str())
                .unwrap_or("")
                .to_string()
        };
        let _ = std::process::Command::new("xdg-open").arg(target).spawn();
    }
}

#[tauri::command]
fn take_pending_open_files(state: State<'_, PendingOpenFiles>) -> Vec<OpenFileRequest> {
    let mut pending = state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    std::mem::take(&mut *pending)
}

#[tauri::command]
fn complete_wait_sessions(markers: Vec<String>) -> Result<(), String> {
    for marker in markers {
        match std::fs::remove_file(&marker) {
            Ok(()) => {}
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
            Err(err) => return Err(format!("failed to complete wait session: {err}")),
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    configure_linux_graphics();

    if handle_wait_client() {
        return;
    }

    let pending_open_files = initial_open_requests_from_args();

    let app = tauri::Builder::default()
        .manage(PendingOpenFiles(Mutex::new(pending_open_files)))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // A second instance was launched — forward any markdown file args
            // to the running instance, then bring its window to front.
            let requests = open_requests_from_args(args.into_iter().skip(1));
            for request in requests {
                let _ = app.emit("marka:open-file", request);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            complete_wait_sessions,
            take_pending_open_files,
            reveal_in_file_manager
        ])
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            {
                let window = _app
                    .get_webview_window("main")
                    .expect("main window missing");
                if let Err(err) = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::Sidebar,
                    Some(NSVisualEffectState::Active),
                    Some(12.0),
                ) {
                    eprintln!("marka.md: apply_vibrancy failed: {err:?}");
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        // macOS Finder "Open With → marka.md" emits this event with file URLs.
        // `RunEvent::Opened` doesn't exist on Windows/Linux — gating the block
        // keeps non-mac compilation clean.
        #[cfg(target_os = "macos")]
        if let RunEvent::Opened { urls } = _event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let path_str = path.to_string_lossy().to_string();
                    if let Some(state) = _app_handle.try_state::<PendingOpenFiles>() {
                        let mut pending = state
                            .0
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                        pending.push(OpenFileRequest {
                            path: path_str.clone(),
                            wait_marker: None,
                        });
                    }
                    let request = OpenFileRequest {
                        path: path_str.clone(),
                        wait_marker: None,
                    };
                    if let Err(err) = _app_handle.emit("marka:open-file", request) {
                        eprintln!("marka.md: failed to emit open-file event: {err:?}");
                    } else {
                        eprintln!("marka.md: open-file requested: {path_str}");
                    }
                }
            }
        }
    });
}

#[cfg(target_os = "linux")]
fn configure_linux_graphics() {
    let session_type = std::env::var_os("XDG_SESSION_TYPE");
    let wayland_display = std::env::var_os("WAYLAND_DISPLAY");
    let is_wayland = is_wayland_session(
        session_type.as_deref().and_then(std::ffi::OsStr::to_str),
        wayland_display.as_deref().and_then(std::ffi::OsStr::to_str),
    );

    if is_wayland && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    // Tauri's bundled GTK AppImage hook historically forces GDK_BACKEND=x11.
    // That can make WebKitGTK fail before the app window is created on Wayland
    // systems. Only replace that packaging default; preserve other user choices.
    if should_override_appimage_gdk_backend(
        is_wayland,
        std::env::var_os("APPIMAGE").is_some(),
        std::env::var_os("GDK_BACKEND")
            .as_deref()
            .and_then(std::ffi::OsStr::to_str),
    ) {
        std::env::set_var("GDK_BACKEND", "wayland,x11");
    }
}

#[cfg(any(target_os = "linux", test))]
fn is_wayland_session(session_type: Option<&str>, wayland_display: Option<&str>) -> bool {
    session_type == Some("wayland") || wayland_display.is_some_and(|display| !display.is_empty())
}

#[cfg(any(target_os = "linux", test))]
fn should_override_appimage_gdk_backend(
    is_wayland: bool,
    is_appimage: bool,
    gdk_backend: Option<&str>,
) -> bool {
    is_wayland && is_appimage && gdk_backend == Some("x11")
}

#[cfg(test)]
mod linux_graphics_tests {
    use super::{is_wayland_session, should_override_appimage_gdk_backend};

    #[test]
    fn detects_wayland_from_session_type() {
        assert!(is_wayland_session(Some("wayland"), None));
    }

    #[test]
    fn detects_wayland_when_only_display_variable_is_available() {
        assert!(is_wayland_session(None, Some("wayland-0")));
    }

    #[test]
    fn does_not_treat_x11_as_wayland() {
        assert!(!is_wayland_session(Some("x11"), None));
        assert!(!is_wayland_session(None, Some("")));
    }

    #[test]
    fn overrides_only_the_appimage_x11_default() {
        assert!(should_override_appimage_gdk_backend(
            true,
            true,
            Some("x11")
        ));
        assert!(!should_override_appimage_gdk_backend(
            true,
            false,
            Some("x11")
        ));
        assert!(!should_override_appimage_gdk_backend(
            true,
            true,
            Some("wayland")
        ));
        assert!(!should_override_appimage_gdk_backend(
            false,
            true,
            Some("x11")
        ));
    }
}
