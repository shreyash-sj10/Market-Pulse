/**
 * Path A (P0-C): access JWT only in JS memory — not localStorage (XSS surface reduction).
 * Survives SPA navigation; cleared on full page reload (then silent refresh restores via HttpOnly refresh cookie).
 */
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(next) {
  accessToken = next || null;
}

export function clearAccessToken() {
  accessToken = null;
}
