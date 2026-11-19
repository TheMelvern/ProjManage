<template>
  <main class="auth-page">
    <div class="auth-layout">
      <aside class="auth-story" aria-label="PMO Portal workspace introduction">
        <div class="story-brand">
          <span class="story-logo">P</span>
          <span>PMO Portal</span>
          <span class="story-version">WORKSPACE</span>
        </div>
        <div class="story-main">
          <div class="story-kicker"><span class="story-dot"></span> CONNECTED OPERATIONS</div>
          <p class="auth-story-title">Clarity across every project.</p>
          <p class="story-intro">A single workspace for delivery, governance, people and portfolio intelligence.</p>
          <div class="workspace-preview" aria-label="Illustrative portfolio dashboard preview">
            <div class="preview-header">
              <div><small>PORTFOLIO SNAPSHOT</small><strong>Overview</strong></div>
              <span class="preview-icon material-symbols-outlined" aria-hidden="true">dashboard</span>
            </div>
            <div class="preview-metrics">
              <div><span class="mini-icon material-symbols-outlined" aria-hidden="true">folder_open</span><strong>24</strong><small>Projects</small></div>
              <div><span class="mini-icon material-symbols-outlined" aria-hidden="true">verified_user</span><strong>92%</strong><small>On track</small></div>
              <div><span class="mini-icon material-symbols-outlined" aria-hidden="true">task_alt</span><strong>18</strong><small>Completed</small></div>
            </div>
            <div class="preview-trend">
              <div class="trend-label"><span>Delivery momentum</span><span class="trend-pill">Illustrative</span></div>
              <div class="trend-bars" aria-hidden="true"><i style="--bar:38%"></i><i style="--bar:53%"></i><i style="--bar:47%"></i><i style="--bar:66%"></i><i style="--bar:61%"></i><i style="--bar:78%"></i><i style="--bar:86%"></i><i style="--bar:74%"></i><i style="--bar:93%"></i></div>
            </div>
          </div>
        </div>
        <div class="story-footer"><span class="material-symbols-outlined" aria-hidden="true">lock</span> Protected by organization access controls</div>
      </aside>

      <section class="auth-form-card" aria-labelledby="login-heading">
        <div class="mobile-brand"><span class="story-logo">P</span><strong>PMO Portal</strong></div>
        <div class="form-heading">
          <p class="auth-eyebrow">PMO PORTAL / ACCOUNT ACCESS</p>
          <h1 id="login-heading">{{ mfaChallenge ? 'Secure verification' : 'Welcome back' }}</h1>
          <p class="auth-intro">{{ mfaChallenge ? 'Complete your second security step to access the workspace.' : 'Sign in to continue to your connected workspace.' }}</p>
        </div>

        <p v-if="error" class="auth-alert" role="alert">{{ error }}</p>

        <form v-if="!mfaChallenge" class="auth-form" @submit.prevent="handleLogin">
          <label for="login-email">Work email address</label>
          <div class="input-wrap">
            <span class="material-symbols-outlined" aria-hidden="true">mail</span>
            <input id="login-email" v-model.trim="email" type="email" autocomplete="username"
              placeholder="name@company.com" required />
          </div>

          <div class="password-row">
            <label for="login-password">Password</label>
            <router-link to="/forgot-password">Forgot password?</router-link>
          </div>
          <div class="input-wrap">
            <span class="material-symbols-outlined" aria-hidden="true">lock_outline</span>
            <input id="login-password" v-model="password" :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password" placeholder="••••••••" required />
            <button class="password-toggle" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword">
              <span class="material-symbols-outlined" aria-hidden="true">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>

          <label class="remember-label"><input v-model="rememberMe" type="checkbox" /> Remember my email</label>

          <button type="submit" class="auth-primary" :disabled="isLoading">
            <span>{{ isLoading ? 'Signing in…' : 'Sign In' }}</span>
            <span class="material-symbols-outlined" aria-hidden="true">{{ isLoading ? 'hourglass_empty' : 'arrow_forward' }}</span>
          </button>
        </form>

        <form v-else class="auth-form" @submit.prevent="completeMfa">
          <label for="mfa-login-code">Authenticator or recovery code</label>
          <div class="input-wrap">
            <span class="material-symbols-outlined" aria-hidden="true">shield_lock</span>
            <input id="mfa-login-code" v-model.trim="mfaCode" autocomplete="one-time-code"
              placeholder="6-digit code or recovery code" required maxlength="32" />
          </div>
          <p class="auth-tip">Use your authenticator app or an unused recovery code.</p>
          <button type="submit" class="auth-primary" :disabled="isLoading || !mfaCode">
            <span>{{ isLoading ? 'Verifying…' : 'Verify and sign in' }}</span>
            <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>
          <button type="button" class="back-button" @click="cancelMfa">Use another account</button>
        </form>

        <div class="auth-divider"><span>NEW TO PMO PORTAL?</span></div>
        <p class="auth-linkline">Need workspace access? <router-link to="/signup">Create an account</router-link></p>
        <p class="verify-link"><router-link to="/resend-verification">Resend verification email</router-link></p>
        <div class="security-footer"><span class="material-symbols-outlined" aria-hidden="true">verified_user</span> Secure sign-in · Organization governed access</div>
      </section>
    </div>
    <footer class="page-footer">© {{ currentYear }} PMO Portal · One connected workspace</footer>
  </main>
</template>

<script>
import axiosInstance from '../../../api/axiosConfig';
import { applyStoredAppearance } from '../../../utils/appearance';

export default {
  name: 'Login',
  data() {
    return {
      email: '', password: '', showPassword: false, rememberMe: false,
      isLoading: false, error: '', mfaChallenge: '', mfaCode: '',
      currentYear: new Date().getFullYear()
    };
  },
  methods: {
    storeSession(payload) {
      localStorage.setItem('access_token', payload.accessToken);
      const nextUser={ ...payload.user, lastLogin: new Date().toISOString() };
      localStorage.setItem('user', JSON.stringify(nextUser));
      applyStoredAppearance(nextUser);
      if (this.rememberMe) localStorage.setItem('rememberedEmail', this.email);
      else localStorage.removeItem('rememberedEmail');
      this.$router.replace('/portfolio');
    },
    describe(error) {
      const message = error.response?.data?.message;
      return Array.isArray(message) ? message.join(', ') : message || error.message || 'Unable to sign in.';
    },
    async handleLogin() {
      this.error = '';
      if (import.meta.env.VITE_USE_LIVE_API !== 'true') {
        this.error = 'API login is not configured. Set VITE_USE_LIVE_API=true.';
        return;
      }
      this.isLoading = true;
      try {
        const response = await axiosInstance.post('/auth/login', { email: this.email, password: this.password });
        const payload = response.data?.data;
        if (payload?.requiresMfa && payload.challengeToken) {
          this.mfaChallenge = payload.challengeToken;
          this.mfaCode = '';
          this.password = '';
          return;
        }
        if (!payload?.accessToken || !payload?.user) throw new Error('Unexpected authentication response');
        this.storeSession(payload);
      } catch (error) {
        this.error = this.describe(error);
      } finally {
        this.isLoading = false;
      }
    },
    async completeMfa() {
      this.error = '';
      this.isLoading = true;
      try {
        const response = await axiosInstance.post('/auth/mfa/complete', {
          challengeToken: this.mfaChallenge, code: this.mfaCode
        });
        const payload = response.data?.data;
        if (!payload?.accessToken || !payload?.user) throw new Error('Unexpected MFA response');
        this.storeSession(payload);
      } catch (error) {
        this.error = this.describe(error);
      } finally {
        this.isLoading = false;
      }
    },
    cancelMfa() {
      this.mfaChallenge = '';
      this.mfaCode = '';
      this.password = '';
      this.error = '';
    }
  },
  mounted() {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      this.email = rememberedEmail;
      this.rememberMe = true;
    }
  }
};
</script>
<style scoped>
.auth-page{min-height:100vh;background:var(--pmo-accent-soft);padding:38px 24px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:Inter,system-ui,sans-serif;color:var(--pmo-text)}
.auth-layout{display:grid;grid-template-columns:.9fr 1.1fr;gap:22px;max-width:1100px;width:100%;align-items:stretch}
.auth-story{background:#14223d;position:relative;overflow:hidden;border-radius:20px;min-height:625px;padding:34px 38px;display:flex;flex-direction:column;color:#fff}
.auth-story:before{content:"";position:absolute;width:360px;height:360px;right:-185px;top:70px;border-radius:50%;background:radial-gradient(circle,#6d85e630,transparent 70%);pointer-events:none}
.story-brand{display:flex;align-items:center;gap:11px;font-size:18px;font-weight:800;position:relative;z-index:1}
.story-logo{width:38px;height:38px;display:inline-grid;place-items:center;border-radius:11px;background:var(--pmo-accent);color:#14223d;font-weight:900;font-size:20px}
.story-version{border:1px solid #506489;color:var(--pmo-muted);font-size:9px;letter-spacing:.12em;padding:5px 8px;border-radius:30px;margin-left:auto}
.story-main{margin:auto 0;position:relative;z-index:1}
.story-kicker{font-size:10px;font-weight:800;color:var(--pmo-muted);letter-spacing:.13em;display:flex;gap:8px;align-items:center}
.story-dot{width:7px;height:7px;border-radius:50%;background:#8ae4b6}
.auth-story .auth-story-title{font-size:clamp(34px,3.8vw,49px);line-height:1.12;letter-spacing:-.035em;max-width:470px;margin:19px 0 13px;font-weight:800}
.story-intro{max-width:440px;color:var(--pmo-muted);font-size:13px;line-height:1.8;margin:0 0 25px}
.workspace-preview{padding:17px;background:#ffffff0e;border:1px solid #ffffff27;border-radius:16px;backdrop-filter:blur(10px)}
.preview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
.preview-header div{display:grid;gap:5px}
.preview-header small{font-size:9px;color:var(--pmo-muted);letter-spacing:.12em;font-weight:750}
.preview-header strong{font-size:15px}
.preview-icon{font-size:20px;color:var(--pmo-muted)}
.preview-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.preview-metrics>div{min-width:0;display:grid;gap:6px;border-radius:10px;background:#ffffff10;padding:11px}
.mini-icon{color:var(--pmo-muted);font-size:16px}
.preview-metrics strong{font-size:21px;line-height:1.2}
.preview-metrics small{color:var(--pmo-muted);font-size:10px}
.preview-trend{border-top:1px solid #ffffff1e;margin-top:14px;padding-top:14px}
.trend-label{display:flex;align-items:center;justify-content:space-between;color:var(--pmo-muted);font-size:11px;font-weight:650}
.trend-pill{color:var(--pmo-muted);background:#ffffff16;border-radius:30px;padding:4px 7px;font-size:9px}
.trend-bars{display:flex;align-items:flex-end;gap:8px;height:56px;margin-top:11px}
.trend-bars i{height:var(--bar);flex:1;min-width:0;background:linear-gradient(#91aaff,#5a78d9);border-radius:5px 5px 2px 2px;opacity:.95}
.story-footer{display:flex;align-items:center;gap:8px;color:var(--pmo-muted);font-size:11px;position:relative;z-index:1}
.story-footer .material-symbols-outlined{font-size:17px}
.auth-form-card{background:#fff;border:1px solid var(--pmo-border);border-radius:20px;padding:50px clamp(28px,5vw,68px);display:flex;flex-direction:column;justify-content:center;box-shadow:0 18px 60px color-mix(in srgb, var(--pmo-accent) 4%, transparent);min-width:0}
.mobile-brand{display:none;align-items:center;gap:10px;margin-bottom:20px;color:#14223d}
.form-heading{margin-bottom:26px}
.auth-eyebrow{color:var(--pmo-accent-ink);font-size:10px;font-weight:800;letter-spacing:.11em;margin:0 0 14px}
.auth-form-card #login-heading{font-size:31px;line-height:1.18;letter-spacing:-.03em;margin:0 0 9px}
.auth-intro{font-size:13px;line-height:1.65;color:#64748b;margin:0}
.auth-form{display:grid;gap:12px}
.auth-form>label,.password-row label{font-size:12px;font-weight:750;color:var(--pmo-text)}
.password-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}
.password-row a,.auth-linkline a,.verify-link a{color:var(--pmo-accent-ink);font-size:12px;font-weight:750;text-decoration:none}
.password-row a:hover,.auth-linkline a:hover,.verify-link a:hover{text-decoration:underline}
.input-wrap{display:flex;align-items:center;gap:10px;min-height:49px;padding:0 12px;border:1px solid var(--pmo-border);background:var(--pmo-accent-soft);border-radius:10px;transition:border-color .18s,box-shadow .18s}
.input-wrap:focus-within{border-color:var(--pmo-accent);box-shadow:0 0 0 3px color-mix(in srgb, var(--pmo-accent) 20%, transparent)}
.input-wrap>.material-symbols-outlined{color:#8495ad;font-size:19px}
.input-wrap input{min-width:0;flex:1;height:48px;padding:0;border:0;outline:0;background:transparent;color:var(--pmo-text);font-size:13px}
.input-wrap input::placeholder{color:#9aa9bf}
.password-toggle{background:none;border:0;cursor:pointer;padding:7px;color:#6b7e9b;display:grid;place-items:center}
.password-toggle .material-symbols-outlined{font-size:19px}
.remember-label{display:flex;align-items:center;gap:9px;margin:4px 0 7px;font-size:12px!important;color:#64748b!important;font-weight:550!important;cursor:pointer}
.remember-label input{accent-color:#315ac4;width:15px;height:15px}
.auth-primary{border:0;border-radius:10px;background:var(--pmo-accent);color:var(--pmo-on-accent);font-weight:800;padding:15px 17px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:13px;cursor:pointer;transition:transform .15s,background .15s,box-shadow .15s}
.auth-primary:hover:not(:disabled){background:var(--pmo-accent);box-shadow:0 8px 20px color-mix(in srgb, var(--pmo-accent) 20%, transparent);transform:translateY(-1px)}
.auth-primary:disabled{opacity:.6;cursor:not-allowed}
.auth-primary .material-symbols-outlined{font-size:17px}
.auth-divider{display:flex;align-items:center;gap:14px;color:#95a1b4;font-size:10px;font-weight:800;letter-spacing:.09em;margin:30px 0 16px}
.auth-divider:before,.auth-divider:after{content:"";height:1px;background:var(--pmo-accent-soft);flex:1}
.auth-linkline,.verify-link{font-size:12px;text-align:center;color:#65758b;margin:0}
.verify-link{margin-top:14px}
.security-footer{margin-top:30px;padding-top:18px;border-top:1px solid var(--pmo-border);display:flex;gap:8px;align-items:center;color:#8a99ae;font-size:11px;justify-content:center}
.security-footer .material-symbols-outlined{font-size:18px;color:var(--pmo-accent-ink)}
.auth-alert{font-size:12px;line-height:1.5;padding:12px 14px;border-radius:10px;background:#ffe8ed;color:#a42d48;margin:0 0 16px}
.auth-tip{background:var(--pmo-accent-soft);color:#526983;padding:12px;border-radius:9px;font-size:12px;margin:2px 0}
.back-button{background:transparent;border:0;color:var(--pmo-accent-ink);font-size:12px;font-weight:750;cursor:pointer;padding:10px}
.page-footer{font-size:11px;color:#98a4b7;text-align:center}
@media(max-width:900px){.auth-page{padding:22px 16px}.auth-layout{grid-template-columns:1fr;max-width:600px}.auth-story{min-height:0;padding:25px}.story-main{margin:22px 0}.auth-story .auth-story-title{font-size:28px}.workspace-preview{display:none}.story-footer{font-size:10px}.auth-form-card{padding:32px}.form-heading{margin-bottom:24px}}
@media(max-width:540px){.auth-page{padding:0;background:#fff;gap:0}.auth-layout{display:block}.auth-story{display:none}.auth-form-card{min-height:calc(100dvh - 38px);border:0;box-shadow:none;border-radius:0;padding:28px 22px}.mobile-brand{display:flex}.auth-form-card #login-heading{font-size:28px}.page-footer{background:#fff;padding:0 0 17px}}
@media(prefers-reduced-motion:reduce){.auth-primary,.input-wrap{transition:none}.auth-primary:hover{transform:none}}

/* SaaS authentication: centered frosted card over abstract blurred image artwork. */
.auth-page{position:relative;isolation:isolate;min-height:100dvh;padding:34px 18px;background:#10223f;overflow:hidden}
.auth-page::before{content:"";position:fixed;z-index:-2;inset:-25px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1440' height='900' viewBox='0 0 1440 900'%3E%3Cdefs%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%230b1631'/%3E%3Cstop offset='.52' stop-color='%232a5085'/%3E%3Cstop offset='1' stop-color='%2386aec6'/%3E%3C/linearGradient%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='95'/%3E%3C/filter%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M0 0h1440v900H0z'/%3E%3Cg filter='url(%23b)'%3E%3Cellipse cx='330' cy='235' rx='350' ry='210' fill='%23496de1'/%3E%3Cellipse cx='1190' cy='210' rx='310' ry='270' fill='%2383bfd9'/%3E%3Cellipse cx='920' cy='785' rx='460' ry='210' fill='%233957a8'/%3E%3Cellipse cx='110' cy='810' rx='360' ry='300' fill='%23628dab'/%3E%3C/g%3E%3C/svg%3E");background-size:cover;background-position:center;filter:blur(10px) saturate(1.16);transform:scale(1.06)}
.auth-page::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(140deg,#08172f77,#0c1a3160 55%,#182b5377)}
.auth-layout{display:grid;grid-template-columns:minmax(0,1fr);width:100%;max-width:476px;gap:0}
.auth-story{display:none}
.auth-form-card{border:1px solid #ffffffac;border-radius:24px;min-height:560px;padding:45px clamp(24px,5vw,47px);background:#fffffff0;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 28px 90px #0611245c}
.mobile-brand{display:flex}
.page-footer{color:var(--pmo-muted)}
@media(max-width:900px){.auth-page{padding:24px 16px}.auth-layout{max-width:476px}.auth-form-card{padding:35px}}
@media(max-width:540px){.auth-page{padding:18px 12px;background:#10223f;gap:12px}.auth-layout{display:grid}.auth-form-card{min-height:auto;border:1px solid #ffffffac;border-radius:20px;padding:30px 23px}.page-footer{background:transparent;padding:0 0 10px;color:var(--pmo-muted)}}
</style>