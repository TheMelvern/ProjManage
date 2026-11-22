import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { applyStoredAppearance } from '../../../utils/appearance';
import './Login.css';

interface Session {
  accessToken?: string;
  user?: { id?: string; themeMode?: unknown; accentColor?: unknown; [key: string]: unknown };
  requiresMfa?: boolean;
  challengeToken?: string;
}

interface Props {
  link: (path: string) => string;
  afterSignIn: () => void;
}

function describe(error: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(error) ? error.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (error instanceof Error ? error.message : 'Unable to sign in.');
}

export function Login({ link, afterSignIn }: Props) {
  const [email, setEmail] = useState(() => localStorage.getItem('rememberedEmail') ?? '');
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('rememberedEmail')));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const busy = useRef(false);
  const currentYear = new Date().getFullYear();

  async function signIn(endpoint: string, body: object) {
    if (busy.current) return;
    busy.current = true;
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post<{ data: Session }>(endpoint, body);
      const payload = response.data?.data;
      if (endpoint === '/auth/login' && payload?.requiresMfa && payload.challengeToken) {
        setMfaChallenge(payload.challengeToken);
        setMfaCode('');
        setPassword('');
        return;
      }
      if (!payload?.accessToken || !payload.user) throw new Error('Unexpected authentication response');
      localStorage.setItem('access_token', payload.accessToken);
      const user = { ...payload.user, lastLogin: new Date().toISOString() };
      localStorage.setItem('user', JSON.stringify(user));
      applyStoredAppearance(user);
      if (rememberMe) localStorage.setItem('rememberedEmail', email.trim());
      else localStorage.removeItem('rememberedEmail');
      afterSignIn();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (import.meta.env.VITE_USE_LIVE_API !== 'true') {
      setError('API login is not configured. Set VITE_USE_LIVE_API=true.');
      return;
    }
    void signIn('/auth/login', { email: email.trim(), password });
  }

  function completeMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn('/auth/mfa/complete', { challengeToken: mfaChallenge, code: mfaCode.trim() });
  }

  function cancelMfa() {
    setMfaChallenge('');
    setMfaCode('');
    setPassword('');
    setError('');
  }

  return (
    <div className="login-screen">
  <main className="auth-page login-content">
    <div className="auth-layout">
      <aside className="auth-story" aria-label="PMO Portal workspace introduction">
        <div className="story-brand">
          <span className="story-logo">P</span>
          <span>PMO Portal</span>
          <span className="story-version">WORKSPACE</span>
        </div>
        <div className="story-main">
          <div className="story-kicker"><span className="story-dot"></span> CONNECTED OPERATIONS</div>
          <p className="auth-story-title">Clarity across every project.</p>
          <p className="story-intro">A single workspace for delivery, governance, people and portfolio intelligence.</p>
          <div className="workspace-preview" aria-label="Illustrative portfolio dashboard preview">
            <div className="preview-header">
              <div><small>PORTFOLIO SNAPSHOT</small><strong>Overview</strong></div>
              <span className="preview-icon material-symbols-outlined" aria-hidden="true">dashboard</span>
            </div>
            <div className="preview-metrics">
              <div><span className="mini-icon material-symbols-outlined" aria-hidden="true">folder_open</span><strong>24</strong><small>Projects</small></div>
              <div><span className="mini-icon material-symbols-outlined" aria-hidden="true">verified_user</span><strong>92%</strong><small>On track</small></div>
              <div><span className="mini-icon material-symbols-outlined" aria-hidden="true">task_alt</span><strong>18</strong><small>Completed</small></div>
            </div>
            <div className="preview-trend">
              <div className="trend-label"><span>Delivery momentum</span><span className="trend-pill">Illustrative</span></div>
              <div className="trend-bars" aria-hidden="true"><i style={{ '--bar': '38%' } as CSSProperties}></i><i style={{ '--bar': '53%' } as CSSProperties}></i><i style={{ '--bar': '47%' } as CSSProperties}></i><i style={{ '--bar': '66%' } as CSSProperties}></i><i style={{ '--bar': '61%' } as CSSProperties}></i><i style={{ '--bar': '78%' } as CSSProperties}></i><i style={{ '--bar': '86%' } as CSSProperties}></i><i style={{ '--bar': '74%' } as CSSProperties}></i><i style={{ '--bar': '93%' } as CSSProperties}></i></div>
            </div>
          </div>
        </div>
        <div className="story-footer"><span className="material-symbols-outlined" aria-hidden="true">lock</span> Protected by organization access controls</div>
      </aside>

      <section className="auth-form-card" aria-labelledby="login-heading">
        <div className="mobile-brand"><span className="story-logo">P</span><strong>PMO Portal</strong></div>
        <div className="form-heading">
          <p className="auth-eyebrow">PMO PORTAL / ACCOUNT ACCESS</p>
          <h1 id="login-heading">{mfaChallenge ? 'Secure verification' : 'Welcome back'}</h1>
          <p className="auth-intro">{mfaChallenge ? 'Complete your second security step to access the workspace.' : 'Sign in to continue to your connected workspace.'}</p>
        </div>

        {error && <p className="auth-alert" role="alert">{error}</p>}

        {!mfaChallenge ? <form className="auth-form" onSubmit={handleLogin}>
          <label htmlFor="login-email">Work email address</label>
          <div className="input-wrap">
            <span className="material-symbols-outlined" aria-hidden="true">mail</span>
            <input id="login-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="username"
              placeholder="name@company.com" required />
          </div>

          <div className="password-row">
            <label htmlFor="login-password">Password</label>
            <a href={link("/forgot-password")}>Forgot password?</a>
          </div>
          <div className="input-wrap">
            <span className="material-symbols-outlined" aria-hidden="true">lock_outline</span>
            <input id="login-password" value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'}
              autoComplete="current-password" placeholder="••••••••" required />
            <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}>
              <span className="material-symbols-outlined" aria-hidden="true">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>

          <label className="remember-label"><input checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} type="checkbox" /> Remember my email</label>

          <button type="submit" className="auth-primary" disabled={isLoading}>
            <span>{isLoading ? 'Signing in…' : 'Sign In'}</span>
            <span className="material-symbols-outlined" aria-hidden="true">{isLoading ? 'hourglass_empty' : 'arrow_forward'}</span>
          </button>
        </form> : <form className="auth-form" onSubmit={completeMfa}>
          <label htmlFor="mfa-login-code">Authenticator or recovery code</label>
          <div className="input-wrap">
            <span className="material-symbols-outlined" aria-hidden="true">shield_lock</span>
            <input id="mfa-login-code" value={mfaCode} onChange={event => setMfaCode(event.target.value)} autoComplete="one-time-code"
              placeholder="6-digit code or recovery code" required maxLength={32} />
          </div>
          <p className="auth-tip">Use your authenticator app or an unused recovery code.</p>
          <button type="submit" className="auth-primary" disabled={isLoading || !mfaCode}>
            <span>{isLoading ? 'Verifying…' : 'Verify and sign in'}</span>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>
          <button type="button" className="back-button" onClick={cancelMfa}>Use another account</button>
        </form>}

        <div className="auth-divider"><span>NEW TO PMO PORTAL?</span></div>
        <p className="auth-linkline">Need workspace access? <a href={link("/signup")}>Create an account</a></p>
        <p className="verify-link"><a href={link("/resend-verification")}>Resend verification email</a></p>
        <div className="security-footer"><span className="material-symbols-outlined" aria-hidden="true">verified_user</span> Secure sign-in · Organization governed access</div>
      </section>
    </div>
    <footer className="page-footer">© {currentYear} PMO Portal · One connected workspace</footer>
  </main>
    </div>
  );
}
