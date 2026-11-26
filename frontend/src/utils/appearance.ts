// User-specific visual preferences. Server profile is authoritative after sign-in.
export const APPEARANCE_MODES = ['system', 'light', 'dark'];
export const ACCENT_COLORS = ['blue', 'graphite', 'purple', 'teal', 'green', 'rose'];
interface Appearance {
  themeMode?: unknown;
  accentColor?: unknown;
}
type AppearanceUser = Appearance & { id?: string };

const storageKey = (id: string) => 'pmo-appearance:' + id;
const publicAppearanceKey = 'pmo-public-appearance';
function readPublicAppearance(){try{return JSON.parse(localStorage.getItem(publicAppearanceKey)||'{}');}catch{return {};}}
function storePublicAppearance(preferences: Appearance){try{localStorage.setItem(publicAppearanceKey,JSON.stringify(normalize(preferences)));}catch{/* Browser storage may be disabled. */}}
const normalize = (value?: Appearance | null) => ({
  themeMode: typeof value?.themeMode === 'string' && APPEARANCE_MODES.includes(value.themeMode) ? value.themeMode : 'system',
  accentColor: typeof value?.accentColor === 'string' && ACCENT_COLORS.includes(value.accentColor) ? value.accentColor : 'blue'
});
export function applyAppearance(value?: Appearance | null) {
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
export function applyStoredAppearance(user?: AppearanceUser | null) {
  if (!user?.id) return initializeAppearance();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey(user.id)) || '{}'); }
  catch { /* Invalid preferences should never block sign-in. */ }
  const applied = applyAppearance({ ...saved, ...user });
  storePublicAppearance(applied);
  return applied;
}
export function saveAppearance(userId: string | null | undefined, preferences: Appearance) {
  const clean = applyAppearance(preferences);
  if (userId) localStorage.setItem(storageKey(userId), JSON.stringify(clean));
  storePublicAppearance(clean);
  return clean;
}
export function resetAppearance() {
  return initializeAppearance();
}
