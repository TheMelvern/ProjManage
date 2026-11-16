// User-specific visual preferences. Server profile is authoritative after sign-in.
export const APPEARANCE_MODES = ['system', 'light', 'dark'];
export const ACCENT_COLORS = ['blue', 'graphite', 'purple', 'teal', 'green', 'rose'];
const storageKey = id => 'pmo-appearance:' + id;
const normalize = value => ({
  themeMode: APPEARANCE_MODES.includes(value?.themeMode) ? value.themeMode : 'system',
  accentColor: ACCENT_COLORS.includes(value?.accentColor) ? value.accentColor : 'blue'
});
export function applyAppearance(value) {
  const prefs = normalize(value);
  const root = document.documentElement;
  root.dataset.theme = prefs.themeMode;
  root.dataset.accent = prefs.accentColor;
  root.style.colorScheme = prefs.themeMode === 'system' ? 'light dark' : prefs.themeMode;
  return prefs;
}
export function applyStoredAppearance(user) {
  if (!user?.id) return applyAppearance({});
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey(user.id)) || '{}'); }
  catch { /* Invalid preferences should never block sign-in. */ }
  return applyAppearance({ ...saved, ...user });
}
export function saveAppearance(userId, preferences) {
  const clean = applyAppearance(preferences);
  if (userId) localStorage.setItem(storageKey(userId), JSON.stringify(clean));
  return clean;
}
export function resetAppearance() {
  return applyAppearance({});
}
