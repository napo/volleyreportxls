import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { isTauriApp, openInSystemBrowser } from './updates';

/**
 * External link (GitHub, licence, PayPal). On the web a normal link in a new tab; in the installed apps
 * the webview would not open it, so the click goes to the system browser. Nothing is requested before
 * the user clicks.
 */
export function ExternalLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isTauriApp()) return;
    event.preventDefault();
    openInSystemBrowser(href).catch(() => {});
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} {...props}>
      {children}
    </a>
  );
}
