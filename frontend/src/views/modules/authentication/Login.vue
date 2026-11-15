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
          <h1>Clarity across every project.</h1>
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
          <h2 id="login-heading">{{ mfaChallenge ? 'Secure verification' : 'Welcome back' }}</h2>
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
      localStorage.setItem('user', JSON.stringify({ ...payload.user, lastLogin: new Date().toISOString() }));
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
.auth-page{min-height:100vh;background:#f4f7fb;padding:38px 24px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:Inter,system-ui,sans-serif;color:#18253c}
.auth-layout{display:grid;grid-template-columns:.9fr 1.1fr;gap:22px;max-width:1100px;width:100%;align-items:stretch}
.auth-story{background:#14223d;position:relative;overflow:hidden;border-radius:20px;min-height:625px;padding:34px 38px;display:flex;flex-direction:column;color:#fff}
.auth-story:before{content:"";position:absolute;width:360px;height:360px;right:-185px;top:70px;border-radius:50%;background:radial-gradient(circle,#6d85e630,transparent 70%);pointer-events:none}
.story-brand{display:flex;align-items:center;gap:11px;font-size:18px;font-weight:800;position:relative;z-index:1}
.story-logo{width:38px;height:38px;display:inline-grid;place-items:center;border-radius:11px;background:#8da6ff;color:#14223d;font-weight:900;font-size:20px}
.story-version{border:1px solid #506489;color:#b3c6ea;font-size:9px;letter-spacing:.12em;padding:5px 8px;border-radius:30px;margin-left:auto}
.story-main{margin:auto 0;position:relative;z-index:1}
.story-kicker{font-size:10px;font-weight:800;color:#a9c0f5;letter-spacing:.13em;display:flex;gap:8px;align-items:center}
.story-dot{width:7px;height:7px;border-radius:50%;background:#8ae4b6}
.auth-story h1{font-size:clamp(34px,3.8vw,49px);line-height:1.12;letter-spacing:-.035em;max-width:470px;margin:19px 0 13px;font-weight:800}
.story-intro{max-width:440px;color:#becce6;font-size:13px;line-height:1.8;margin:0 0 25px}
.workspace-preview{padding:17px;background:#ffffff0e;border:1px solid #ffffff27;border-radius:16px;backdrop-filter:blur(10px)}
.preview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
.preview-header div{display:grid;gap:5px}
.preview-header small{font-size:9px;color:#aec1e5;letter-spacing:.12em;font-weight:750}
.preview-header strong{font-size:15px}
.preview-icon{font-size:20px;color:#a9baf2}
.preview-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.preview-metrics>div{min-width:0;display:grid;gap:6px;border-radius:10px;background:#ffffff10;padding:11px}
.mini-icon{color:#a9bdf1;font-size:16px}
.preview-metrics strong{font-size:21px;line-height:1.2}
.preview-metrics small{color:#bccbe7;font-size:10px}
.preview-trend{border-top:1px solid #ffffff1e;margin-top:14px;padding-top:14px}
.trend-label{display:flex;align-items:center;justify-content:space-between;color:#d4def3;font-size:11px;font-weight:650}
.trend-pill{color:#b7c9e8;background:#ffffff16;border-radius:30px;padding:4px 7px;font-size:9px}
.trend-bars{display:flex;align-items:flex-end;gap:8px;height:56px;margin-top:11px}
.trend-bars i{height:var(--bar);flex:1;min-width:0;background:linear-gradient(#91aaff,#5a78d9);border-radius:5px 5px 2px 2px;opacity:.95}
.story-footer{display:flex;align-items:center;gap:8px;color:#b6c5df;font-size:11px;position:relative;z-index:1}
.story-footer .material-symbols-outlined{font-size:17px}
.auth-form-card{background:#fff;border:1px solid #e3e9f3;border-radius:20px;padding:50px clamp(28px,5vw,68px);display:flex;flex-direction:column;justify-content:center;box-shadow:0 18px 60px #213a6309;min-width:0}
.mobile-brand{display:none;align-items:center;gap:10px;margin-bottom:20px;color:#14223d}
.form-heading{margin-bottom:26px}
.auth-eyebrow{color:#647fc0;font-size:10px;font-weight:800;letter-spacing:.11em;margin:0 0 14px}
.auth-form-card h2{font-size:31px;line-height:1.18;letter-spacing:-.03em;margin:0 0 9px}
.auth-intro{font-size:13px;line-height:1.65;color:#64748b;margin:0}
.auth-form{display:grid;gap:12px}
.auth-form>label,.password-row label{font-size:12px;font-weight:750;color:#304059}
.password-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}
.password-row a,.auth-linkline a,.verify-link a{color:#315ac4;font-size:12px;font-weight:750;text-decoration:none}
.password-row a:hover,.auth-linkline a:hover,.verify-link a:hover{text-decoration:underline}
.input-wrap{display:flex;align-items:center;gap:10px;min-height:49px;padding:0 12px;border:1px solid #dae3f0;background:#f7f9fd;border-radius:10px;transition:border-color .18s,box-shadow .18s}
.input-wrap:focus-within{border-color:#7396e1;box-shadow:0 0 0 3px #9db9f533}
.input-wrap>.material-symbols-outlined{color:#8495ad;font-size:19px}
.input-wrap input{min-width:0;flex:1;height:48px;padding:0;border:0;outline:0;background:transparent;color:#18253c;font-size:13px}
.input-wrap input::placeholder{color:#9aa9bf}
.password-toggle{background:none;border:0;cursor:pointer;padding:7px;color:#6b7e9b;display:grid;place-items:center}
.password-toggle .material-symbols-outlined{font-size:19px}
.remember-label{display:flex;align-items:center;gap:9px;margin:4px 0 7px;font-size:12px!important;color:#64748b!important;font-weight:550!important;cursor:pointer}
.remember-label input{accent-color:#315ac4;width:15px;height:15px}
.auth-primary{border:0;border-radius:10px;background:#315ac4;color:#fff;font-weight:800;padding:15px 17px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:13px;cursor:pointer;transition:transform .15s,background .15s,box-shadow .15s}
.auth-primary:hover:not(:disabled){background:#274cb0;box-shadow:0 8px 20px #315ac432;transform:translateY(-1px)}
.auth-primary:disabled{opacity:.6;cursor:not-allowed}
.auth-primary .material-symbols-outlined{font-size:17px}
.auth-divider{display:flex;align-items:center;gap:14px;color:#95a1b4;font-size:10px;font-weight:800;letter-spacing:.09em;margin:30px 0 16px}
.auth-divider:before,.auth-divider:after{content:"";height:1px;background:#e6ebf3;flex:1}
.auth-linkline,.verify-link{font-size:12px;text-align:center;color:#65758b;margin:0}
.verify-link{margin-top:14px}
.security-footer{margin-top:30px;padding-top:18px;border-top:1px solid #e9edf5;display:flex;gap:8px;align-items:center;color:#8a99ae;font-size:11px;justify-content:center}
.security-footer .material-symbols-outlined{font-size:18px;color:#5f83c8}
.auth-alert{font-size:12px;line-height:1.5;padding:12px 14px;border-radius:10px;background:#ffe8ed;color:#a42d48;margin:0 0 16px}
.auth-tip{background:#eef3fc;color:#526983;padding:12px;border-radius:9px;font-size:12px;margin:2px 0}
.back-button{background:transparent;border:0;color:#315ac4;font-size:12px;font-weight:750;cursor:pointer;padding:10px}
.page-footer{font-size:11px;color:#98a4b7;text-align:center}
@media(max-width:900px){.auth-page{padding:22px 16px}.auth-layout{grid-template-columns:1fr;max-width:600px}.auth-story{min-height:0;padding:25px}.story-main{margin:22px 0}.auth-story h1{font-size:28px}.workspace-preview{display:none}.story-footer{font-size:10px}.auth-form-card{padding:32px}.form-heading{margin-bottom:24px}}
@media(max-width:540px){.auth-page{padding:0;background:#fff;gap:0}.auth-layout{display:block}.auth-story{display:none}.auth-form-card{min-height:calc(100dvh - 38px);border:0;box-shadow:none;border-radius:0;padding:28px 22px}.mobile-brand{display:flex}.auth-form-card h2{font-size:28px}.page-footer{background:#fff;padding:0 0 17px}}
@media(prefers-reduced-motion:reduce){.auth-primary,.input-wrap{transition:none}.auth-primary:hover{transform:none}}
</style>