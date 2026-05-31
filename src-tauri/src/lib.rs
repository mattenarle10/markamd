#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

use std::sync::Mutex;
use tauri::State;

// `Manager` powers `_app.get_webview_window` in the macOS setup block,
// `Emitter` powers the file-open event below, and `RunEvent::Opened` is a
// macOS-only enum variant (Finder "Open With" file association). Gating the
// whole `use` line lets the crate compile on Windows + Linux where the
// variant doesn't exist.
#[cfg(target_os = "macos")]
use tauri::{Emitter, Manager, RunEvent};

struct PendingOpenFiles(Mutex<Vec<String>>);

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
        let _ = std::process::Command::new("open").args(["-R", &path]).spawn();
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
fn take_pending_open_files(state: State<'_, PendingOpenFiles>) -> Vec<String> {
    let mut pending = state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    std::mem::take(&mut *pending)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingOpenFiles(Mutex::new(Vec::new())))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![take_pending_open_files, reveal_in_file_manager])
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            {
                let window = _app.get_webview_window("main").expect("main window missing");
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
                        pending.push(path_str.clone());
                    }
                    if let Err(err) = _app_handle.emit("marka:open-file", path_str.clone()) {
                        eprintln!("marka.md: failed to emit open-file event: {err:?}");
                    } else {
                        eprintln!("marka.md: open-file requested: {path_str}");
                    }
                }
            }
        }
    });
}
