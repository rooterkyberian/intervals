# Intervals

**Live app: https://rooterkyberian.github.io/intervals/**

Offline-first interval workout timer PWA. No backend, no accounts, no build step — plain HTML/CSS/JS served statically.

## Features

- **Timer engine** — configurable countdown, work/rest intervals, rounds, and multiple sets with a longer rest between sets. Pause / resume / restart. Big color-coded display (yellow = countdown, green = work, red = rest, orange = set rest).
- **Audio & haptics** — beeps on every phase change, 3-2-1 lead-in ticks, distinct finish sound. All tones are generated with the Web Audio API (no audio files, works offline). Mute toggle and optional vibration (Android).
- **Presets** — built-ins (Tabata, HIIT 30/15, Boxing 3min) plus your own named presets, persisted in `localStorage`.
- **PWA** — installable (`manifest.json`, `display: standalone`), cache-first service worker for 100% offline use, and the Screen Wake Lock + Fullscreen APIs keep the screen on and distraction-free for the whole workout (start to stop).

## Development

No tooling required — serve the directory over HTTP (service workers need HTTP(S), `file://` won't do):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

After changing any asset, bump the `CACHE` version in `sw.js` so installed clients pick up the update.

## Deployment

Static hosting of the repository root is all that's needed. A GitHub Actions workflow (`.github/workflows/pages.yml`) deploys to GitHub Pages on every push to `main` — enable **Settings → Pages → Source: GitHub Actions** once.

All URLs are relative, so the app works from a subpath (e.g. `https://<user>.github.io/intervals/`) as well as a root domain.

## Implementation notes

- **No timer drift**: the engine never chains `setTimeout`; every tick recomputes state from `performance.now()` timestamps, so a 100 ms interval (or a long throttled gap in a background tab) always lands on the correct phase and remaining time.
- **Audio unlock**: the `AudioContext` is created/resumed inside the Start tap handler, satisfying browser autoplay policies.
- **Background throttling**: on `visibilitychange` the app forces a tick, snapping the display to the correct state after the browser throttled the interval.
