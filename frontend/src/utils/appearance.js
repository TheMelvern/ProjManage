// User-specific visual preferences. Server profile is authoritative after sign-in.
export const APPEARANCE_MODES = ['system', 'light', 'dark'];
export const ACCENT_COLORS = ['blue', 'graphite', 'purple', 'teal', 'green', 'rose'];
const storageKey = id => 'pmo-appearance:' + id;
const publicAppearanceKey = 'pmo-public-appearance';
function readPublicAppearance(){try{return JSON.parse(localStorage.getItem(publicAppearanceKey)||'{}');}catch{return {};}}
function storePublicAppearance(preferences){try{localStorage.setItem(publicAppearanceKey,JSON.stringify(normalize(preferences)));}catch{/* Browser storage may be disabled. */}}
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
export function initializeAppearance(){
  // Preserve the last appearance for public authentication screens, without exposing any account data.
  return applyAppearance(readPublicAppearance());
}
export function applyStoredAppearance(user) {
  if (!user?.id) return initializeAppearance();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey(user.id)) || '{}'); }
  catch { /* Invalid preferences should never block sign-in. */ }
  const applied = applyAppearance({ ...saved, ...user });
  storePublicAppearance(applied);
  return applied;
}
export function saveAppearance(userId, preferences) {
  const clean = applyAppearance(preferences);
  if (userId) localStorage.setItem(storageKey(userId), JSON.stringify(clean));
  storePublicAppearance(clean);
  return clean;
}
export function resetAppearance() {
  return initializeAppearance();
}
