const STORAGE_KEY = 'ims-pro-demo-profile';

export type DemoProfile = {
  displayName?: string;
  email?: string;
  phone?: string;
  location?: string;
  photoURL?: string;
};

export function getDemoProfile(): DemoProfile {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDemoProfile(profile: DemoProfile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event('ims-pro-demo-profile-change'));
}

export function subscribeDemoProfile(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('ims-pro-demo-profile-change', onChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('ims-pro-demo-profile-change', onChange);
  };
}
