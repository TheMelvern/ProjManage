import { useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import './Signup.css';

const emptyForm = { firstName: '', lastName: '', email: '', organization: '', password: '', confirm: '' };

export function Signup({ link }: { link: (path: string) => string }) {
  const [form, setForm] = useState(emptyForm);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const submitting = useRef(false);

  function setField(field: keyof typeof emptyForm, value: string) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !consent) return;
    setError('');
    setSuccess('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 12) {
      setError('Password must contain at least 12 characters.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    try {
      const result = await api.post<{ data: { message?: string } }>('/auth/register', {
        name: [form.firstName.trim(), form.lastName.trim()].join(' ').trim(),
        email: form.email.trim(),
        organization: form.organization.trim(),
        password: form.password,
      });
      setSuccess(result.data.data.message || 'Request submitted. Ask your administrator to approve your access.');
      setForm(current => ({ ...current, password: '', confirm: '' }));
    } catch (cause) {
      const message = isAxiosError<{ message?: string | string[] }>(cause) ? cause.response?.data?.message : undefined;
      setError((Array.isArray(message) ? message.join(', ') : message) || 'Registration request failed.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="signup-screen">
  <main className="auth-page">
    <section className="auth-layout" aria-label="PMO Portal account registration">
      <aside className="auth-story">
        <p className="auth-eyebrow">YOUR WORKSPACE / ONE ACCOUNT</p>
        <h1>Bring your team into a connected PMO.</h1>
        <p>Track delivery, review approvals and keep project decisions aligned across your organization.</p>
        <ol>
          <li>Unified project portfolio</li>
          <li>Independent maker–checker governance</li>
          <li>Leave and resource visibility</li>
          <li>Executive reporting</li>
        </ol>
        <p className="auth-disclaimer">Account access requires administrator approval followed by email verification.</p>
      </aside>
      <section className="auth-form-card">
        <p className="auth-eyebrow">PMO PORTAL / ACCOUNT ACCESS</p>
        <h2>Create your account</h2>
        <p className="auth-intro">Request access to your organization's workspace.</p>
        <form onSubmit={register}>
          <div className="auth-grid">
            <label>First name <input value={form.firstName} onChange={event => setField("firstName", event.target.value)} autoComplete="given-name" required minLength={1} maxLength={70} /></label>
            <label>Last name <input value={form.lastName} onChange={event => setField("lastName", event.target.value)} autoComplete="family-name" required minLength={1} maxLength={70} /></label>
          </div>
          <label>Work email address <input value={form.email} onChange={event => setField("email", event.target.value)} type="email" autoComplete="email" placeholder="name@company.com" required /></label>
          <label>Organization name <input value={form.organization} onChange={event => setField("organization", event.target.value)} autoComplete="organization" placeholder="Organization provided by your administrator" required minLength={2} /></label>
          <div className="auth-grid">
            <label>Password <input value={form.password} onChange={event => setField("password", event.target.value)} type="password" autoComplete="new-password" placeholder="At least 12 characters" minLength={12} required /></label>
            <label>Confirm password <input value={form.confirm} onChange={event => setField("confirm", event.target.value)} type="password" autoComplete="new-password" minLength={12} required /></label>
          </div>
          <p className="auth-tip">Use a unique password of at least 12 characters. No access token is issued until approval and email verification.</p>
          <label className="auth-consent"><input checked={consent} onChange={event => setConsent(event.target.checked)} type="checkbox" required /> I agree to the workspace access policy.</label>
          {error && <p className="auth-alert" role="alert">{error}</p>}
          {success && <p className="auth-success" role="status">{success}</p>}
          <button className="auth-primary" type="submit" disabled={busy || !consent}> {busy ? 'Submitting…' : 'Request account'} </button>
        </form>
        <p className="auth-linkline">Already have an account? <a href={link("/login")}>Sign in</a></p>
      </section>
    </section>
  </main>
    </div>
  );
}
