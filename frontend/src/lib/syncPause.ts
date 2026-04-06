const STORAGE_KEY = 'ims-pro-sync-paused';
const EVENT_NAME = 'ims-pro-sync-pause-change';

function readPausedState() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

function writePausedState(paused: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, String(paused));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function pauseFirestoreSync() {
  writePausedState(true);
}

export function resumeFirestoreSync() {
  writePausedState(false);
}

export function isFirestoreSyncPaused() {
  return readPausedState();
}

export function subscribeFirestoreSyncPause(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(EVENT_NAME, onChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(EVENT_NAME, onChange);
  };
}
