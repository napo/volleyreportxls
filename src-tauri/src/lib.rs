// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

#[cfg(desktop)]
mod oauth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // External links and download pages open in the system browser
        .plugin(tauri_plugin_opener::init())
        // "Save as" dialog and writing of the chosen file (PDFs)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Google sign-in and Drive, for the synchronisation chosen by the user
        .plugin(tauri_plugin_http::init())
        // Google sign-in on Android (plugins/google-auth); it does nothing elsewhere
        .plugin(tauri_plugin_google_auth::init());

    // Automatic updates, always confirmed by the user in the app, and the
    // Google sign-in through the system browser (desktop only)
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(oauth::Pending::default())
        .invoke_handler(tauri::generate_handler![oauth::oauth_listen, oauth::oauth_wait]);

    builder
        .run(tauri::generate_context!())
        .expect("Impossibile avviare VolleyReport");
}
