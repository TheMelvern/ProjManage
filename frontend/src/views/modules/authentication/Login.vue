<template>
  <div class="login-container">
    <!-- Split Screen Container -->
    <div class="login-split-screen">
      <!-- Left Side: Visual Branding (Hidden on mobile) -->
      <div class="login-branding-panel">
        <!-- Background Image with Overlay -->
        <div class="login-background-image"></div>
        <div class="login-branding-overlay"></div>

        <!-- Branding Content -->
        <div class="login-branding-content">
          <div class="login-branding-header">
            <div class="login-branding-logo">
              <span class="material-symbols-outlined login-branding-icon">group</span>
            </div>
            <span class="login-branding-title">PMO Portal</span>
          </div>
          <h1 class="login-branding-headline">
            Project Portfolio Intelligence
          </h1>
          <p class="login-branding-description">
            Organize delivery, risks, project effort and executive reporting in one place.
          </p>
          <div class="login-branding-features">
            <div class="login-branding-feature">
              <span class="material-symbols-outlined login-feature-icon">verified_user</span>
              <span>Enterprise Secure</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Side: Authentication Panel -->
      <div class="login-auth-panel">
        <div class="login-auth-content">
          <!-- Page Heading -->
          <div class="login-auth-header">
            <div class="login-mobile-branding">
              <span class="material-symbols-outlined login-mobile-icon">group</span>
              <span class="login-mobile-title">PMO Portal</span>
            </div>
            <h2 class="login-auth-title">Welcome Back</h2>
            <p class="login-auth-subtitle">Please enter your credentials to access the system.</p>
          </div>

          <!-- Login Form -->
          <form v-if="!mfaChallenge" class="login-form" @submit.prevent="handleLogin">
            <!-- Email Field -->
            <div class="login-form-group">
              <label class="login-form-label">Work Email</label>
              <div class="login-input-wrapper">
                <input v-model="email" class="login-form-input" placeholder="name@company.com" type="email"
                  required />
              </div>
            </div>

            <!-- Password Field -->
            <div class="login-form-group">
              <div class="login-form-header">
                <label class="login-form-label">Password</label>
<router-link class="login-form-hint" to="/forgot-password">Forgot password?</router-link>
              </div>
              <div class="login-input-wrapper login-password-wrapper">
                <input v-model="password" :type="showPassword ? 'text' : 'password'"
                  class="login-form-input login-password-input" placeholder="••••••••" required />
                <button @click="togglePasswordVisibility" type="button" class="login-password-toggle">
                  <span class="material-symbols-outlined">
                    {{ showPassword ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Remember Me Checkbox -->
            <div class="login-remember">
              <input v-model="rememberMe" id="remember-me" type="checkbox" class="login-checkbox" />
              <label for="remember-me" class="login-checkbox-label">
                Remember me
              </label>
              
            </div>

            <!-- Login Button -->
            <button type="submit" class="login-submit-btn" :disabled="isLoading">
              <span v-if="!isLoading">Sign In</span>
              <span v-else>
                <span class="loading-spinner"></span>
                Signing In...
              </span>
              <span class="material-symbols-outlined login-submit-icon">login</span>
            </button>

          </form>

          <form v-else class="login-form mfa-form" @submit.prevent="completeMfa">
            <p class="mfa-explainer">Your account is protected by two-factor authentication. Enter your six-digit authenticator code or an unused recovery code.</p>
            <div class="login-form-group">
              <label for="mfa-login-code" class="login-form-label">Authenticator or recovery code</label>
              <input id="mfa-login-code" v-model.trim="mfaCode" class="login-form-input" autocomplete="one-time-code"
                placeholder="123456 or recovery code" required maxlength="32"/>
            </div>
            <button type="submit" class="login-submit-btn" :disabled="isLoading || !mfaCode">
              {{ isLoading ? 'Verifying…' : 'Verify and sign in' }}
            </button>
            <button type="button" class="mfa-back" @click="cancelMfa">Use another account</button>
          </form>

          <p class="signup-prompt">New to PMO Portal? <router-link to="/signup">Create an account</router-link> · <router-link to="/resend-verification">Verify email</router-link></p>

          <!-- Support Footer -->
          <div class="login-footer">
            <div class="login-footer-links">
              <span class="login-footer-link">PMO Workspace</span>
              <span class="login-footer-link">Local development</span>
            </div>
            <div class="login-system-status">
              <div class="login-status-indicator"></div>
              <span class="login-status-text">Secure sign-in</span>
            </div>
          </div>
        </div>

        <!-- Global Footer for bottom edge -->
        <div class="login-copyright">
          <p class="login-copyright-text">
            © {{ currentYear }} PMO Portal · Secure workspace
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axiosInstance from '../../../api/axiosConfig';
import '../../../styles/views/authenticate/login.css';

export default {
  name: 'Login',
  data() {
    return {
      email: '',
      password: '',
      mfaChallenge: '',
      mfaCode: '',
      showPassword: false,
      rememberMe: false,
      isLoading: false,
      currentYear: new Date().getFullYear()
    };
  },
  methods: {
    togglePasswordVisibility() {
      this.showPassword = !this.showPassword;
    },
    async handleLogin() {
      if (!this.email || !this.password) {
        this.showError('Please enter both email and password');
        return;
      }
      if (import.meta.env.VITE_USE_LIVE_API !== 'true') {
        this.showError('API login is not configured. Set VITE_USE_LIVE_API=true.');
        return;
      }
      this.isLoading = true;
      try {
        const response = await axiosInstance.post('/auth/login', {
          email: this.email, password: this.password
        });
        const payload = response.data.data;
        if (payload?.requiresMfa && payload.challengeToken) {
          this.mfaChallenge = payload.challengeToken;
          this.mfaCode = '';
          return;
        }
        if (!payload?.accessToken || !payload?.user) {
          throw new Error('Unexpected authentication response');
        }
        this.storeSession(payload);
      } catch (error) {
        this.showError(error.response?.data?.message || 'Unable to sign in. Check your API and credentials.');
      } finally {
        this.isLoading = false;
      }
    },
    storeSession(payload) {
        localStorage.setItem('access_token', payload.accessToken);
        localStorage.setItem('user', JSON.stringify({
          ...payload.user, lastLogin: new Date().toISOString()
        }));
        if (this.rememberMe) localStorage.setItem('rememberedEmail', this.email);
        else localStorage.removeItem('rememberedEmail');
        this.$router.push('/portfolio');
    },
    async completeMfa() {
      this.isLoading = true;
      try {
        const response = await axiosInstance.post('/auth/mfa/complete', {
          challengeToken: this.mfaChallenge, code: this.mfaCode
        });
        if (!response.data?.data?.accessToken) throw new Error('Unexpected MFA response');
        this.storeSession(response.data.data);
        this.mfaChallenge = '';
        this.mfaCode = '';
      } catch (error) {
        this.showError(error.response?.data?.message || 'Invalid or expired authenticator code');
      } finally { this.isLoading = false; }
    },
    cancelMfa() {
      this.mfaChallenge = '';
      this.mfaCode = '';
      this.password = '';
    },
    showError(message) {
      window.alert(message);
    }
  },
  mounted() {
    // Check for remembered email
    const rememberedEmail = localStorage.getItem('rememberedEmail')
    if (rememberedEmail) {
      this.email = rememberedEmail
      this.rememberMe = true
    }
    
    // Local demo sessions are not accepted in live API mode.
    if (import.meta.env.VITE_USE_LIVE_API === 'true' && !localStorage.getItem('access_token')) {
      localStorage.removeItem('user');
      return;
    }
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const user = JSON.parse(storedUser)
      // Optional: Auto-redirect if session is recent (less than 1 hour)
      const lastLogin = new Date(user.lastLogin)
      const now = new Date()
      const hoursDiff = (now - lastLogin) / (1000 * 60 * 60)
      
      if (hoursDiff < 1) {
        this.$router.push('/portfolio')
      }
    }
  }
}
</script>

<style scoped>
.mfa-explainer{color:#607086;font-size:13px;line-height:1.6;margin:8px 0 20px}.mfa-form{margin-top:16px}.mfa-back{background:transparent;border:0;color:#315ac4;text-align:center;font-weight:750;padding:11px;cursor:pointer}
.signup-prompt{margin:18px 0;color:#64748b;font-size:13px}.signup-prompt a{color:#315ac4;text-decoration:none;font-weight:800}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
@
/* Demo Credentials Styles */
.demo-credentials {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  animation: slideIn 0.3s ease;
}

.dark .demo-credentials {
  background: linear-gradient(135deg, #0c4a6e 0%, #075985 100%);
  border-color: #0ea5e9;
}

.demo-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.demo-icon {
  color: #0ea5e9;
  font-size: 1.5rem;
}

.demo-header h3 {
  margin: 0;
  color: #0369a1;
  font-size: 1.1rem;
  font-weight: 600;
}

.dark .demo-header h3 {
  color: #bae6fd;
}

.demo-description {
  color: #475569;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.dark .demo-description {
  color: #cbd5e1;
}

.demo-accounts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.demo-account {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.demo-account:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #0ea5e9;
}

.dark .demo-account {
  background: #1e293b;
  border-color: #334155;
}

.dark .demo-account:hover {
  border-color: #0ea5e9;
  background: #334155;
}

.demo-account-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: #f0f9ff;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0ea5e9;
}

.dark .demo-account-icon {
  background: #075985;
}

.demo-account-info {
  flex: 1;
}

.demo-account-email {
  font-weight: 500;
  color: #1e293b;
  font-size: 0.9rem;
}

.dark .demo-account-email {
  color: #f1f5f9;
}

.demo-account-role {
  font-size: 0.8rem;
  color: #64748b;
}

.dark .demo-account-role {
  color: #94a3b8;
}

.demo-account-password {
  font-size: 0.8rem;
  color: #059669;
  font-weight: 500;
  background: #d1fae5;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.dark .demo-account-password {
  color: #10b981;
  background: #064e3b;
}

.demo-hide-btn {
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #64748b;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.demo-hide-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.dark .demo-hide-btn {
  border-color: #475569;
  color: #94a3b8;
}

.dark .demo-hide-btn:hover {
  background: #334155;
}

.demo-toggle-btn {
  margin-left: auto;
  padding: 0.375rem 0.75rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.demo-toggle-btn:hover {
  background: #e0f2fe;
  transform: translateY(-1px);
}

.dark .demo-toggle-btn {
  background: #075985;
  border-color: #0ea5e9;
  color: #bae6fd;
}

/* Role Selection Styles */
.role-selection {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.role-option:hover {
  border-color: #0ea5e9;
  background: #f0f9ff;
}

.role-option.selected {
  border-color: #0ea5e9;
  background: #f0f9ff;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.dark .role-option {
  border-color: #475569;
}

.dark .role-option:hover,
.dark .role-option.selected {
  border-color: #0ea5e9;
  background: #1e293b;
}

.role-icon {
  color: #64748b;
  font-size: 1.5rem;
}

.role-option.selected .role-icon {
  color: #0ea5e9;
}

.role-info {
  flex: 1;
}

.role-name {
  font-weight: 500;
  color: #1e293b;
}

.dark .role-name {
  color: #f1f5f9;
}

.role-description {
  font-size: 0.8rem;
  color: #64748b;
}

.dark .role-description {
  color: #94a3b8;
}

/* Loading Spinner */
.loading-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Remember Me Section Adjustments */
.login-remember {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .demo-account {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .demo-account-password {
    align-self: stretch;
    text-align: center;
  }
  
  .login-remember {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .demo-toggle-btn {
    margin-left: 0;
    width: 100%;
  }
}

/* Add to existing CSS */
.login-checkbox-label {
  white-space: nowrap;
}
</style>