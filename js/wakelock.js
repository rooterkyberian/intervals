// Screen Wake Lock — keep the display on during a workout.
// The lock is released by the OS when the page is hidden, so we re-acquire
// on visibilitychange while a workout is active.

let sentinel = null;
let wanted = false;

export async function acquire() {
  wanted = true;
  if (!('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch {
    // e.g. low battery or permission denied — the app still works
  }
}

export function release() {
  wanted = false;
  sentinel?.release().catch(() => {});
  sentinel = null;
}

document.addEventListener('visibilitychange', () => {
  if (wanted && !sentinel && document.visibilityState === 'visible') {
    acquire();
  }
});
