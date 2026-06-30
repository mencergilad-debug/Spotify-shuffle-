# Spotify True Shuffle Mobile

A free, phone-friendly, static web tool that creates or refreshes a private Spotify playlist called **Liked Songs – True Shuffle**.

It does **not** replace Spotify's shuffle button. It creates a playlist whose order is already random. Play it in Spotify with **Shuffle OFF** and **Repeat OFF**.

## What it does

1. Connects to your Spotify account using Spotify OAuth PKCE.
2. Reads all your Liked Songs.
3. Randomly shuffles them using browser crypto randomness.
4. Creates or refreshes a private playlist called **Liked Songs – True Shuffle**.
5. You open Spotify mobile and play that playlist from the top.

## Files

- `index.html` — mobile page
- `style.css` — styling
- `app.js` — Spotify login, true shuffle, playlist refresh

## Free hosting option: GitHub Pages

### 1. Create a GitHub account
Go to GitHub and create a free account if you do not have one.

### 2. Create a new repository
Create a repository called:

```text
spotify-true-shuffle
```

Set it to **Public**. GitHub Pages is easiest with a public repo.

### 3. Upload these files
Upload:

```text
index.html
style.css
app.js
README.md
```

### 4. Enable GitHub Pages
Go to:

```text
Settings → Pages
```

Set:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

Save.

GitHub will give you a URL like:

```text
https://YOUR-USERNAME.github.io/spotify-true-shuffle/
```

Copy this URL.

## Spotify Developer setup

### 1. Create a Spotify Developer app
Go to the Spotify Developer Dashboard and create an app.

Suggested details:

```text
App name: True Shuffle
Description: Personal liked songs shuffle tool
Redirect URI: https://YOUR-USERNAME.github.io/spotify-true-shuffle/
```

The redirect URI must exactly match your GitHub Pages URL, including the final `/`.

### 2. Get the Client ID
Open your Spotify app settings in the Developer Dashboard and copy the **Client ID**.

You do not need to paste your Client Secret into this tool. This app uses PKCE, which is designed for browser/mobile-style apps.

## First use on your phone

1. Open the GitHub Pages URL on your phone.
2. Paste the Spotify Client ID.
3. Tap **Save Client ID**.
4. Tap **Connect Spotify**.
5. Approve the Spotify permissions.
6. Tap **Refresh True Shuffle**.
7. Open Spotify.
8. Play **Liked Songs – True Shuffle** with Shuffle OFF and Repeat OFF.

## Permissions requested

- `user-library-read` — read your Liked Songs.
- `playlist-read-private` — find the private True Shuffle playlist if it already exists.
- `playlist-modify-private` — create or update the private True Shuffle playlist.

## Important limitation

If you press Spotify's own Shuffle button, Spotify may still repeat the same bad behaviour. The point of this tool is to make the playlist order random first, then play it normally.

## Troubleshooting

### INVALID_CLIENT or redirect error
Your Redirect URI in Spotify Developer Dashboard does not exactly match the URL in your browser.

### The page says connected but refresh fails
Tap **Disconnect**, then **Connect Spotify** again.

### It only creates 100 songs
This version writes the first 100 by replacing the playlist, then adds the rest in batches of 100. If your browser is closed mid-process, run Refresh again.

### Spotify asks for approval every time
This should not happen unless browser storage is being cleared.
