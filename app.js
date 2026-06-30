const PLAYLIST_NAME = 'Liked Songs – True Shuffle';
const SCOPES = ['user-library-read', 'user-read-private', 'playlist-read-private', 'playlist-modify-private', 'playlist-modify-public'];
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

const els = {
  clientId: document.getElementById('clientId'),
  saveClientId: document.getElementById('saveClientId'),
  loginBtn: document.getElementById('loginBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  status: document.getElementById('status'),
  progress: document.getElementById('progress'),
};

function setStatus(message) { els.status.textContent = message; }
function setProgress(value, hidden = false) { els.progress.hidden = hidden; els.progress.value = value; }
function redirectUri() { return window.location.origin + window.location.pathname; }
function getClientId() { return localStorage.getItem('spotify_client_id') || ''; }
function setClientId(value) { localStorage.setItem('spotify_client_id', value.trim()); }
function getTokenData() { try { return JSON.parse(localStorage.getItem('spotify_token_data') || 'null'); } catch { return null; } }
function setTokenData(data) { localStorage.setItem('spotify_token_data', JSON.stringify(data)); }
function clearTokenData() { localStorage.removeItem('spotify_token_data'); }
function tokenValid() { const t = getTokenData(); return !!(t && t.access_token && Date.now() < t.expires_at - 60000); }

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function login() {
  const clientId = getClientId();
  if (!clientId) throw new Error('Paste and save your Spotify Client ID first.');

  const verifier = randomString(96);
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem('spotify_code_verifier', verifier);

  const state = randomString(32);
  localStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES.join(' '),
    state,
  });

  window.location.href = `${AUTH_URL}?${params}`;
}

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) throw new Error(`Spotify rejected login: ${error}`);
  if (!code) return;

  if (state !== localStorage.getItem('spotify_auth_state')) {
    throw new Error('Login state mismatch. Try connecting again.');
  }

  const verifier = localStorage.getItem('spotify_code_verifier');
  const clientId = getClientId();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Could not get Spotify token.');

  data.expires_at = Date.now() + data.expires_in * 1000;
  setTokenData(data);

  localStorage.removeItem('spotify_code_verifier');
  localStorage.removeItem('spotify_auth_state');
  window.history.replaceState({}, document.title, redirectUri());
}

async function refreshAccessTokenIfNeeded() {
  const t = getTokenData();
  if (!t) throw new Error('Not connected to Spotify.');
  if (tokenValid()) return t.access_token;
  if (!t.refresh_token) throw new Error('Session expired. Disconnect and reconnect.');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: t.refresh_token,
    client_id: getClientId(),
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Could not refresh Spotify token.');

  const next = {
    ...t,
    ...data,
    refresh_token: data.refresh_token || t.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  setTokenData(next);
  return next.access_token;
}

async function spotify(path, options = {}) {
  const accessToken = await refreshAccessTokenIfNeeded();

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`${path} - ${res.status} - ${data?.error?.message || 'Spotify API error'}`);
  }

  return data;
}

async function getAllSavedTrackUris() {
  let url = '/me/tracks?limit=50';
  const uris = [];

  while (url) {
    const data = await spotify(url.startsWith('https://') ? url.replace(API, '') : url);

    for (const item of data.items) {
      if (item.track && item.track.uri) uris.push(item.track.uri);
    }

    url = data.next;
    setStatus(`Loaded ${uris.length} liked songs...`);
    setProgress(Math.min(40, Math.floor(uris.length / Math.max(data.total, 1) * 40)));
  }

  return uris;
}

function trueShuffle(items) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

async function getMe() {
  return await spotify('/me');
}

async function findOrCreatePlaylist(userId) {
  let url = '/me/playlists?limit=50';

  while (url) {
    const data = await spotify(url.startsWith('https://') ? url.replace(API, '') : url);
    const match = data.items.find(
      p => p.name === PLAYLIST_NAME && p.owner?.id === userId
    );

    if (match) return match;
    url = data.next;
  }

  throw new Error(`Playlist "${PLAYLIST_NAME}" not found. Create it manually in Spotify first.`);
}

function chunks(arr, size) {
  const out = [];

  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }

  return out;
}

async function replacePlaylist(playlistId, uris) {
  const groups = chunks(uris, 100);

  await spotify(`/playlists/${playlistId}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({ uris: groups[0] || [] }),
  });

  setProgress(60);

  for (let i = 1; i < groups.length; i++) {
    await spotify(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: groups[i] }),
    });

    setStatus(`Writing shuffled playlist... ${Math.min((i + 1) * 100, uris.length)} of ${uris.length}`);
    setProgress(60 + Math.floor((i / Math.max(groups.length - 1, 1)) * 40));
  }
}

async function refreshTrueShuffle() {
  els.refreshBtn.disabled = true;
  setProgress(1);

  setStatus('Connecting to Spotify...');
  const me = await getMe();

  setStatus('Loading your Liked Songs...');
  const uris = await getAllSavedTrackUris();

  if (!uris.length) throw new Error('No liked songs found.');

  setStatus(`Randomising ${uris.length} liked songs...`);
  setProgress(45);

  const shuffled = trueShuffle(uris);

  setStatus('Finding existing playlist...');
  setProgress(50);

  const playlist = await findOrCreatePlaylist(me.id);

  setStatus('Replacing playlist with fresh random order...');
  await replacePlaylist(playlist.id, shuffled);

  setProgress(100);
  setStatus(`Done. Refreshed: ${PLAYLIST_NAME}\n\nOpen Spotify and play this playlist with Shuffle OFF and Repeat OFF.`);
  els.refreshBtn.disabled = false;
}

function updateUi() {
  els.clientId.value = getClientId();

  const connected = tokenValid() || !!getTokenData();

  els.loginBtn.disabled = connected;
  els.refreshBtn.disabled = !connected;
  els.logoutBtn.disabled = !connected;

  if (connected) setStatus('Connected. Press Refresh True Shuffle.');
}

els.saveClientId.addEventListener('click', () => {
  setClientId(els.clientId.value);
  setStatus('Client ID saved. Now connect Spotify.');
  updateUi();
});

els.loginBtn.addEventListener('click', async () => {
  try {
    await login();
  } catch (e) {
    setStatus(e.message);
  }
});

els.refreshBtn.addEventListener('click', async () => {
  try {
    await refreshTrueShuffle();
  } catch (e) {
    setStatus(`Error: ${e.message}`);
    els.refreshBtn.disabled = false;
  }
});

els.logoutBtn.addEventListener('click', () => {
  clearTokenData();
  setStatus('Disconnected.');
  updateUi();
});

(async function init() {
  try {
    await handleCallback();
  } catch (e) {
    setStatus(`Login error: ${e.message}`);
  }

  updateUi();
})();