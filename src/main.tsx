import '@fontsource-variable/montserrat';
import '@fontsource-variable/rubik';
import '@fontsource-variable/roboto';
import './ui/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

// After a new version of the site is published, a page opened before it asks for code files
// that no longer exist (e.g. the PDF module): reload once to get the new version.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'volleyreport.reloaded-at';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(key) ?? 0);
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Without storage: reload anyway, the guard below still limits it to this event.
  }
  if (Date.now() - last < 60_000) return;
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
