#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // External links and download pages open in the system browser
        .plugin(tauri_plugin_opener::init())
        // "Save as" dialog and writing of the chosen file (PDFs)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    // Automatic updates, always confirmed by the user in the app (desktop only)
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .run(tauri::generate_context!())
        .expect("Impossibile avviare VolleyReport");
}
