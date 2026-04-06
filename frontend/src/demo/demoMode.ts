import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ims-pro-demo-mode';

function getSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  const handleCustomEvent = () => onStoreChange();

  window.addEventListener('storage', handleStorage);
  window.addEventListener('ims-pro-demo-mode-change', handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('ims-pro-demo-mode-change', handleCustomEvent);
  };
}

function setDemoMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  window.dispatchEvent(new Event('ims-pro-demo-mode-change'));
}

export function enableDemoMode() {
  setDemoMode(true);
}

export function disableDemoMode() {
  setDemoMode(false);
}

export function useDemoMode() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
