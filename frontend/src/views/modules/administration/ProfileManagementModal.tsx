import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { applyAppearance, saveAppearance, APPEARANCE_MODES, ACCENT_COLORS } from '../../../utils/appearance';
import './ProfileManagementModal.css';

export interface Profile {
  id?: string; name?: string; email?: string; avatarDataUrl?: string; organization?: string; role?: string;
  department?: string; createdAt?: string; emailVerifiedAt?: string; organizationId?: string;
  themeMode?: string; accentColor?: string;
}
interface Props { onClose: () => void; onUpdated: (profile: Profile) => void; onPasswordChanged: () => void }
const defaults = { themeMode: 'system', accentColor: 'blue' };
const sections = ['Profile', 'Appearance', 'Security'] as const;
const modes = [
  { value: 'system', label: 'System', icon: 'devices' }, { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
].filter(item => APPEARANCE_MODES.includes(item.value));
const accents = ACCENT_COLORS.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const formatRole = (value?: string) => (value || 'MEMBER').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

function describe(error: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(error) ? error.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (error instanceof Error ? error.message : 'Unable to update profile');
}

async function resizeAvatar(file: File) {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 320 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/jpeg', .78);
    if (result.length > 200000) result = canvas.toDataURL('image/jpeg', .5);
    if (result.length > 200000) throw new Error('Image is still too large. Choose a smaller picture.');
    return result;
  } finally {
    image.close();
  }
}

export function ProfileManagementModal({ onClose, onUpdated, onPasswordChanged }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const savedAppearance = useRef(defaults);
  const previewing = useRef(false);
  const pending = useRef(false);
  const [section, setSection] = useState<typeof sections[number]>('Profile');
  const [profile, setProfile] = useState<Profile>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [appearance, setAppearance] = useState(defaults);
  const appearanceDirty = appearance.themeMode !== savedAppearance.current.themeMode || appearance.accentColor !== savedAppearance.current.accentColor;
  const initials = (name || profile.email || 'PM').split(/[\s@.]+/).slice(0, 2).map(part => part.slice(0, 1).toUpperCase()).join('');

  useLayoutEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void api.get<{ data: Profile }>('/profile', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      setProfile(data.data);
      setName(data.data.name || '');
      savedAppearance.current = applyAppearance(data.data);
      setAppearance(savedAppearance.current);
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      if (previewing.current) applyAppearance(savedAppearance.current);
    };
  }, []);

  function close() {
    if (!pending.current) onClose();
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const controls = [...dialog.current.querySelectorAll<HTMLElement>('button,input,a[href]')]
      .filter(node => !node.matches(':disabled') && node.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (document.activeElement === dialog.current || document.activeElement === (event.shiftKey ? first : last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function chooseAppearance(key: keyof typeof defaults, value: string) {
    const next = { ...appearance, [key]: value };
    previewing.current = true;
    setAppearance(next);
    applyAppearance(next);
  }

  function updated(profile: Profile, message: string) {
    setProfile(current => ({ ...current, ...profile }));
    setNotice(message);
    onUpdated(profile);
  }

  function saveAppearancePreferences() {
    void perform(async () => {
      const { data } = await api.patch<{ data: Profile }>('/profile/appearance', appearance);
      savedAppearance.current = saveAppearance(profile.id, data.data);
      previewing.current = false;
      setAppearance(savedAppearance.current);
      updated(data.data, 'Appearance preferences saved.');
    });
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return;
    void perform(async () => {
      const { data } = await api.patch<{ data: Profile }>('/profile', { name: name.trim() });
      setName(data.data.name || name.trim());
      updated(data.data, 'Profile updated successfully.');
    });
  }

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice('');
      setError('Choose a PNG, JPEG or WebP smaller than 5 MB.');
      return;
    }
    void perform(async () => {
      const dataUrl = await resizeAvatar(file);
      const { data } = await api.post<{ data: Profile }>('/profile/avatar', { dataUrl });
      updated(data.data, 'Profile picture updated.');
    });
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (newPassword !== confirmPassword || newPassword.length < 12) {
      setError(newPassword !== confirmPassword ? 'New passwords do not match.' : 'Password must have at least 12 characters.');
      return;
    }
    void perform(async () => {
      await api.post('/profile/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged();
    });
  }

  return (
  <div className="profile-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={handleKey}>
    <section ref={dialog} className="profile-modal" role="dialog" aria-modal="true"
      aria-labelledby="profile-modal-heading" tabIndex={-1}>
      <header className="profile-head">
        <div className="profile-title">
          <span className="profile-avatar">{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="Profile picture" /> : initials}</span>
          <div><p className="profile-eyebrow">ACCOUNT / PERSONAL SETTINGS</p>
            <h2 id="profile-modal-heading">Profile management</h2>
            <p>Manage your account information and credentials.</p></div>
        </div>
        <button type="button" className="close-modal" aria-label="Close profile management" onClick={close}>
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <div className="profile-content">
        {error && <p className="profile-message error" role="alert">{error}</p>}
        {notice && <p className="profile-message success" role="status">{notice}</p>}
        {loading ? <p role="status">Loading profile…</p> : <>
          <div className="work-actions profile-navigation" role="group" aria-label="Account settings section">
            {sections.map(item => <button key={item} type="button" className="pmo-control quiet" aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}
          </div>
          <section hidden={section !== "Profile"} className="profile-section avatar-section">
            <div className="section-heading"><h3>Profile photo</h3><p>Use a square, clear photo for your workspace identity.</p></div>
            <label htmlFor="profile-photo">Upload profile picture (PNG, JPEG or WebP)</label>
            <input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={uploadAvatar} />
            <p className="profile-hint">The image is optimized before uploading. Maximum stored size: 150 KB.</p>
          </section>
          <form hidden={section !== "Profile"} id="save-profile-form" className="profile-section" onSubmit={saveProfile}>
            <div className="section-heading"><h3>Personal information</h3><p>Your name appears throughout the PMO workspace.</p></div>
            <label htmlFor="profile-name">Full name</label>
            <input id="profile-name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={140} autoComplete="name" required/>
            <label htmlFor="profile-email">Email address</label>
            <input id="profile-email" value={profile.email ?? ""} type="email" disabled />
            <p className="profile-hint">Email address changes require a separate verification workflow.</p>
            <div className="profile-grid">
              <div><span>Organization</span><strong>{profile.organization || '—'}</strong></div>
              <div><span>Workspace role</span><strong>{formatRole(profile.role)}</strong></div>
              <div><span>Department</span><strong>{profile.department || 'Not assigned'}</strong></div>
              <div><span>Account created</span><strong>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}</strong></div>
              <div><span>Email verification</span><strong>{profile.emailVerifiedAt ? 'Verified' : 'Pending'}</strong></div>
              <div><span>Organization ID</span><strong className="long-value">{profile.organizationId || '—'}</strong></div>
            </div>
          </form>
          <section hidden={section !== "Appearance"} className="profile-section appearance-section">
            <div className="section-heading"><h3>Appearance</h3><p>Your theme follows you across modules and devices after sign-in.</p></div>
            <fieldset className="appearance-fieldset"><legend>Display mode</legend>
              <div className="appearance-options">
                {modes.map(mode => <button key={mode.value} type="button" disabled={busy} aria-pressed={appearance.themeMode === mode.value} onClick={() => chooseAppearance("themeMode", mode.value)}>
                  <span className="material-symbols-outlined" aria-hidden="true">{mode.icon}</span>{mode.label}
                </button>)}
              </div>
            </fieldset>
            <fieldset className="appearance-fieldset"><legend>Accent color</legend>
              <div className="accent-options">
                {accents.map(accent => <button key={accent.value} type="button" disabled={busy} aria-pressed={appearance.accentColor === accent.value} aria-label={accent.label} title={accent.label} onClick={() => chooseAppearance("accentColor", accent.value)}>
                  <span className="accent-swatch" style={{ backgroundColor: 'var(--pmo-swatch-' + accent.value + ')' }}>{appearance.accentColor === accent.value && <span className="material-symbols-outlined" aria-hidden="true">check</span>}</span>
                  <small>{accent.label}</small>
                </button>)}
              </div>
            </fieldset>
            <p className="profile-hint">Changes preview instantly. Save to keep them on your account.</p>
          </section>
          <form hidden={section !== "Security"} id="change-password-form" className="profile-section" onSubmit={changePassword}>
            <div className="section-heading"><h3>Change password</h3><p>For security, changing your password signs out other sessions and this device.</p></div>
            <label htmlFor="profile-current-password">Current password</label>
            <input id="profile-current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" required />
            <label htmlFor="profile-new-password">New password</label>
            <input id="profile-new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            <label htmlFor="profile-confirm-password">Confirm new password</label>
            <input id="profile-confirm-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </form>
        </>}
      </div>
      <footer className="profile-foot">
        <button type="button" className="pmo-control quiet" onClick={close}>Close</button>
        {!loading && (section === "Profile" ?
          <button type="submit" form="save-profile-form" className="pmo-control primary" disabled={busy || name.trim().length < 2 || name.trim() === profile.name}>Save changes</button>
          : section === "Appearance" ? <button type="button" className="pmo-control primary" disabled={busy || !appearanceDirty} onClick={saveAppearancePreferences}>Save appearance</button>
          : <button type="submit" form="change-password-form" className="pmo-control" disabled={busy || !currentPassword || newPassword.length<12 || !confirmPassword}>Update password</button>
        )}
      </footer>
    </section>
  </div>
  );
}
