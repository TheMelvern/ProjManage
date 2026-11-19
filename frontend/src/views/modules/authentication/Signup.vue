<template>
  <main class="auth-page">
    <section class="auth-layout" aria-label="PMO Portal account registration">
      <aside class="auth-story">
        <p class="auth-eyebrow">YOUR WORKSPACE / ONE ACCOUNT</p>
        <h1>Bring your team into a connected PMO.</h1>
        <p>Track delivery, review approvals and keep project decisions aligned across your organization.</p>
        <ol>
          <li>Unified project portfolio</li>
          <li>Independent maker–checker governance</li>
          <li>Leave and resource visibility</li>
          <li>Executive reporting</li>
        </ol>
        <p class="auth-disclaimer">Account access requires administrator approval followed by email verification.</p>
      </aside>
      <section class="auth-form-card">
        <p class="auth-eyebrow">PMO PORTAL / ACCOUNT ACCESS</p>
        <h2>Create your account</h2>
        <p class="auth-intro">Request access to your organization's workspace.</p>
        <form @submit.prevent="register">
          <div class="auth-grid">
            <label>First name <input v-model.trim="firstName" autocomplete="given-name" required minlength="1" maxlength="70" /></label>
            <label>Last name <input v-model.trim="lastName" autocomplete="family-name" required minlength="1" maxlength="70" /></label>
          </div>
          <label>Work email address <input v-model.trim="email" type="email" autocomplete="email" placeholder="name@company.com" required /></label>
          <label>Organization name <input v-model.trim="organization" autocomplete="organization" placeholder="Organization provided by your administrator" required minlength="2" /></label>
          <div class="auth-grid">
            <label>Password <input v-model="password" type="password" autocomplete="new-password" placeholder="At least 12 characters" minlength="12" required /></label>
            <label>Confirm password <input v-model="confirm" type="password" autocomplete="new-password" minlength="12" required /></label>
          </div>
          <p class="auth-tip">Use a unique password of at least 12 characters. No access token is issued until approval and email verification.</p>
          <label class="auth-consent"><input v-model="consent" type="checkbox" required /> I agree to the workspace access policy.</label>
          <p v-if="error" class="auth-alert" role="alert">{{ error }}</p>
          <p v-if="success" class="auth-success" role="status">{{ success }}</p>
          <button class="auth-primary" type="submit" :disabled="busy || !consent"> {{ busy ? 'Submitting…' : 'Request account' }} </button>
        </form>
        <p class="auth-linkline">Already have an account? <router-link to="/login">Sign in</router-link></p>
      </section>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import axios from '../../../api/axiosConfig';
const firstName = ref(''), lastName = ref(''), email = ref(''), organization = ref('');
const password = ref(''), confirm = ref(''), consent = ref(false), busy = ref(false), error = ref(''), success = ref('');
async function register() {
  error.value = ''; success.value = '';
  if (password.value !== confirm.value) { error.value = 'Passwords do not match.'; return; }
  if (password.value.length < 12) { error.value = 'Password must contain at least 12 characters.'; return; }
  busy.value = true;
  try {
    const result = await axios.post('/auth/register', {
      name: (firstName.value + ' ' + lastName.value).trim(), email: email.value, organization: organization.value, password: password.value
    });
    success.value = result.data.data.message || 'Request submitted. Ask your administrator to approve your access.';
    password.value = ''; confirm.value = '';
  } catch (cause) {
    const message = cause.response?.data?.message;
    error.value = Array.isArray(message) ? message.join(', ') : message || 'Registration request failed.';
  } finally { busy.value = false; }
}
</script>
<style scoped>
.auth-page{min-height:100vh;background:var(--pmo-accent-soft);padding:48px 24px;display:grid;place-items:center;font-family:Inter,system-ui,sans-serif;color:var(--pmo-text)}
.auth-layout{display:grid;grid-template-columns:0.85fr 1.15fr;gap:24px;max-width:1060px;width:100%;align-items:stretch}
.auth-story{border-radius:20px;background:#14223d;color:#fff;padding:46px 36px}.auth-story h1{font-size:clamp(28px,3.4vw,42px);line-height:1.14;margin:28px 0}.auth-story>p{color:var(--pmo-muted);line-height:1.6}.auth-story ol{padding-left:25px;margin:32px 0;display:grid;gap:16px;font-size:14px;font-weight:700}.auth-disclaimer{padding:18px;border-radius:12px;background:var(--pmo-surface-alt)}
.auth-form-card{background:#fff;border:1px solid var(--pmo-border);border-radius:20px;padding:40px}.auth-form-card h2{font-size:30px;margin:12px 0 8px}.auth-intro{color:#64748b;margin:0 0 27px}.auth-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--pmo-accent-ink)}.auth-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
form{display:grid;gap:16px}label{display:grid;gap:8px;font-size:12px;font-weight:700}input:not([type=checkbox]){width:100%;border:1px solid var(--pmo-border);background:var(--pmo-accent-soft);border-radius:10px;padding:13px 14px;font-size:13px;color:var(--pmo-text)}input:focus-visible{outline:3px solid var(--pmo-accent-ink);outline-offset:1px}.auth-tip{font-size:12px;color:#5d6c85;background:var(--pmo-accent-soft);padding:12px 14px;border-radius:10px;margin:0}.auth-consent{display:flex;align-items:center;gap:10px;color:#66758b}.auth-primary{border:0;border-radius:10px;background:var(--pmo-accent);color:var(--pmo-on-accent);font-weight:800;padding:15px;cursor:pointer}.auth-primary:disabled{opacity:.55;cursor:not-allowed}.auth-alert,.auth-success{border-radius:9px;padding:12px;font-size:13px}.auth-alert{color:#a12444;background:#ffe7ec}.auth-success{color:#167554;background:#e4f8ef}.auth-linkline{font-size:13px;color:#66758b;margin:20px 0 0}.auth-linkline a{color:var(--pmo-accent-ink);font-weight:700;text-decoration:none}
@media(max-width:800px){.auth-layout{grid-template-columns:1fr}.auth-story{padding:25px}.auth-story ol{margin:15px 0}.auth-form-card{padding:26px}}@media(max-width:500px){.auth-page{padding:16px}.auth-grid{grid-template-columns:1fr}}
</style>
