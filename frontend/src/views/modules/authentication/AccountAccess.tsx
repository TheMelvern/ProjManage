import { useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import './AccountAccess.css';

const titles={forgot:'Reset your password',reset:'Choose a new password',
  resend:'Resend verification',verify:'Verify your email'};
const descriptions={
  forgot:'Enter your registered work email. A reset link is sent if the account is eligible.',
  reset:'Choose a unique password of at least 12 characters. Existing sessions will be revoked.',
  resend:'After administrator approval, request a fresh verification email for your account.',
  verify:'Confirm your email ownership to activate your independently approved account.'
};

export type Mode = keyof typeof titles;
interface Props {
  mode: Mode;
  token: string;
  link: (path: string) => string;
  removeToken: () => void;
}

export function AccountAccess({ mode, token, link, removeToken }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const submitting = useRef(false);
  const title = titles[mode];
  const intro = descriptions[mode];

  async function execute(path: string, payload: object) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.post<{ data: { message?: string } }>('/auth/' + path, payload);
      const verify = path === 'verify-email';
      const reset = path === 'reset-password';
      setSuccess(result.data.data.message || (verify ? 'Email verified. You can now sign in.' :
        reset ? 'Password reset. Sign in using the new password.' : 'Request submitted.'));
      if (verify || reset) removeToken();
    } catch (failure) {
      const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
      setError((Array.isArray(message) ? message.join(', ') : message) ||
        (failure instanceof Error ? failure.message : 'Unable to complete the request'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void execute(mode === 'forgot' ? 'request-password-reset' : 'resend-verification', { email: email.trim() });
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token) void execute('verify-email', { token });
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    if (!token || submitting.current) return;
    await execute('reset-password', { token, password });
    setPassword('');
    setConfirmation('');
  }

  return (
    <div className="account-access-screen">
  <main className="account-screen">
    <section className="brand">
      <p className="eyebrow">PMO PORTAL / SECURE ACCESS</p>
      <p className="account-story-title">Your workspace, protected.</p>
      <p>Account verification and recovery use short-lived, one-time links delivered to your registered email address.</p>
      <div className="brand-pill"><span className="material-symbols-outlined" aria-hidden="true">verified_user</span> Independent account governance</div>
    </section>
    <section className="account-card">
      <p className="eyebrow">ACCOUNT SECURITY</p>
      <h1>{title}</h1><p className="intro">{intro}</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      {success && <p role="status" className="notice success">{success}</p>}
      {(mode==='forgot' || mode==='resend') && <form onSubmit={sendEmail}>
        <label htmlFor="recovery-email">Work email</label>
        <input id="recovery-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="name@company.com"/>
        <button type="submit" disabled={busy}>{busy?'Submitting…':mode==='forgot'?'Send password reset link':'Send verification link'}</button>
      </form>}
      {(mode==='reset' && token && !success) && <form onSubmit={reset}>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>
        <button type="submit" disabled={busy || !token}>{busy?'Resetting…':'Reset password'}</button>
      </form>}
      {(mode==='verify' && token && !success) && <form onSubmit={verify}>
        <button type="submit" disabled={busy || !token}>{busy?'Verifying…':'Verify my email'}</button>
      </form>}
      {(!token && !success && (mode === 'reset' || mode === 'verify')) && <section className="notice error">
        <p>This {mode === 'reset' ? 'password reset' : 'verification'} link is incomplete.</p>
        <a className="pmo-control" href={link(mode === 'reset' ? '/forgot-password' : '/resend-verification')}>Request a new link</a>
      </section>}
      <div className="account-links">
        <a href={link("/login")}>Back to sign in</a>
        {(mode!=='forgot') && <a href={link("/forgot-password")}>Forgot password?</a>}
        {(mode!=='resend') && <a href={link("/resend-verification")}>Resend verification</a>}
      </div>
    </section>
  </main>
    </div>
  );
}
