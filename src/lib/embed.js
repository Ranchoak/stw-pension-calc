// Embed helpers. The app can't know how much control the host page gives us
// (beehiiv gives very little), so: detect iframe embedding to offer an
// escape hatch, and support ?bg=transparent for hosts where the default
// soft-gray page plane would look like a mistake.

export function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top can throw — which itself means
    // we're inside someone else's frame.
    return true;
  }
}

export function wantsTransparentBg() {
  return new URLSearchParams(window.location.search).get('bg') === 'transparent';
}

// Href for "open in full page" — same URL, minus embed-specific params.
export function fullPageHref() {
  const url = new URL(window.location.href);
  url.searchParams.delete('bg');
  return url.toString();
}
