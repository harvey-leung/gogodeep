/**
 * Cloudflare Turnstile helper for guest (logged-out) scans.
 *
 * The server (diagnose-image edge function) requires a verified Turnstile token
 * for guest requests and fails CLOSED. This module loads the Turnstile script on
 * demand and returns a fresh single-use token using "execute" mode, so the
 * challenge stays invisible unless Cloudflare decides interaction is needed.
 *
 * Setup:
 *   - Client site key  -> VITE_TURNSTILE_SITE_KEY  (.env / hosting env vars)
 *   - Server secret key -> TURNSTILE_SECRET_KEY     (Supabase edge function secret)
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      execute: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

let loaderPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/** True when a site key is configured (i.e. guest verification is enabled). */
export function turnstileConfigured(): boolean {
  return !!SITE_KEY;
}

/**
 * Returns a fresh single-use Turnstile token, or null if not configured,
 * unavailable, or the user dismissed/failed the challenge.
 */
export async function getGuestTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await loadTurnstile();
  } catch {
    return null;
  }
  const ts = window.turnstile;
  if (!ts) return null;

  return new Promise<string | null>((resolve) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.bottom = "16px";
    container.style.right = "16px";
    container.style.zIndex = "9999";
    document.body.appendChild(container);

    let settled = false;
    let widgetId: string | undefined;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (widgetId) ts.remove(widgetId); } catch { /* noop */ }
      try { container.remove(); } catch { /* noop */ }
      resolve(token);
    };
    const timer = setTimeout(() => finish(null), 30_000);

    try {
      widgetId = ts.render(container, {
        sitekey: SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token: string) => finish(token),
        "error-callback": () => finish(null),
        "expired-callback": () => finish(null),
      });
      ts.execute(widgetId);
    } catch {
      finish(null);
    }
  });
}
