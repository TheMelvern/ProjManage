<template>
  <main class="security-page">
    <header class="page-header">
      <div><p class="eyebrow">ACCOUNT / SECURITY</p><h1>Security Settings</h1>
        <p>Manage authenticator-based two-factor authentication and one-time recovery codes.</p></div>
      <router-link class="back-link" to="/portfolio">Back to Portfolio</router-link>
    </header>
    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <div v-if="message" class="notice success" role="status">{{ message }}</div>
    <div v-if="loading" class="card">Loading account security settings…</div>
    <template v-else>
      <section class="metrics">
        <article><small>Two-factor protection</small><strong>{{ status.enabled ? 'Enabled' : 'Not enabled' }}</strong></article>
        <article><small>Recovery codes remaining</small><strong>{{ status.recoveryCodesRemaining }}</strong></article>
        <article><small>Verification method</small><strong>Authenticator app</strong></article>
      </section>
      <section v-if="!status.enabled" class="card">
        <h2>Enable two-factor authentication</h2>
        <p class="muted">Use Google Authenticator, Microsoft Authenticator, 1Password or another standards-compatible app. You will need to sign in again after activation.</p>
        <form v-if="!setupSecret" @submit.prevent="begin">
          <label for="enable-password">Confirm your current password</label>
          <input id="enable-password" v-model="password" type="password" autocomplete="current-password" required/>
          <button type="submit" :disabled="busy">{{ busy?'Preparing…':'Set up authenticator' }}</button>
        </form>
        <form v-else @submit.prevent="confirm">
          <div class="setup-details">
            <strong>1. Add this account to your authenticator</strong>
            <p>Enter the secret manually or paste the setup URI into a compatible authenticator. Do not share either value.</p>
            <label for="auth-secret">Manual setup secret</label>
            <div class="secret-wrap"><code id="auth-secret">{{ setupSecret }}</code>
              <button type="button" class="secondary" @click="copySecret">Copy</button></div>
            <details><summary>Advanced: setup URI</summary><code class="uri">{{ setupUri }}</code></details>
          </div>
          <label for="activation-code">2. Enter your six-digit authenticator code</label>
          <input id="activation-code" v-model.trim="setupCode" autocomplete="one-time-code" inputmode="numeric" minlength="6" maxlength="6" pattern="[0-9]{6}" required placeholder="000000"/>
          <button type="submit" :disabled="busy">{{ busy?'Enabling…':'Confirm and enable MFA' }}</button>
          <button type="button" class="secondary" @click="cancelSetup">Cancel setup</button>
        </form>
      </section>
      <section v-else class="card">
        <h2>Two-factor authentication is active</h2>
        <p class="muted">An authenticator code or unused recovery code is required at every new sign-in. Changing this setting immediately revokes your existing sessions.</p>
        <form @submit.prevent="disable">
          <label for="disable-password">Current password</label>
          <input id="disable-password" v-model="password" type="password" autocomplete="current-password" required/>
          <label for="disable-code">Authenticator or unused recovery code</label>
          <input id="disable-code" v-model.trim="disableCode" autocomplete="one-time-code" required maxlength="32"/>
          <button class="danger" type="submit" :disabled="busy">{{ busy?'Disabling…':'Disable MFA and revoke sessions' }}</button>
        </form>
      </section>
      <section v-if="recoveryCodes.length" class="card recovery-card">
        <h2>Save your recovery codes now</h2>
        <p class="muted">Each code works once. They are displayed only now and cannot be retrieved later. Store them securely, separate from your password.</p>
        <div class="codes"><code v-for="code in recoveryCodes" :key="code">{{ code }}</code></div>
        <button type="button" class="secondary" @click="copyRecovery">Copy recovery codes</button>
        <label class="confirm-save"><input v-model="savedCodes" type="checkbox"/> I saved these codes in a secure location.</label>
        <button type="button" :disabled="!savedCodes" @click="finishEnrollment">Finish and sign in again</button>
      </section>
      <section class="card">
        <h2>Security guidance</h2>
        <p class="muted">Do not store MFA backup codes in shared project documents or browser notes. If you lose your authenticator and all recovery codes, contact an administrator for account recovery procedures.</p>
      </section>
    </template>
  </main>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from '../../../api/axiosConfig';
const router=useRouter(), loading=ref(true),busy=ref(false),error=ref(''),message=ref('');
const status=ref({enabled:false,recoveryCodesRemaining:0});
const password=ref(''), setupSecret=ref(''),setupUri=ref(''),setupCode=ref(''),disableCode=ref('');
const recoveryCodes=ref([]),savedCodes=ref(false);
function describe(e){const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Unable to complete request';}
async function refresh(){
 loading.value=true;error.value='';
 try{status.value=(await axios.get('/auth/mfa/status')).data.data;}catch(e){error.value=describe(e);}
 finally{loading.value=false;}
}
async function begin(){busy.value=true;error.value='';message.value='';
 try{
   const result=(await axios.post('/auth/mfa/setup',{password:password.value})).data.data;
   setupSecret.value=result.secret;setupUri.value=result.otpauthUri;password.value='';
 }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
async function confirm(){busy.value=true;error.value='';message.value='';
 try{
   const result=(await axios.post('/auth/mfa/confirm',{code:setupCode.value})).data.data;
   recoveryCodes.value=result.recoveryCodes;setupSecret.value='';setupUri.value='';setupCode.value='';
   status.value.enabled=true;status.value.recoveryCodesRemaining=recoveryCodes.value.length;
   message.value='Authenticator enrolled. Save your recovery codes before finishing.';
 }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
function cancelSetup(){setupSecret.value='';setupUri.value='';setupCode.value='';}
async function disable(){busy.value=true;error.value='';
 try{await axios.post('/auth/mfa/disable',{password:password.value,code:disableCode.value});
   message.value='MFA disabled. All sessions were revoked.';
   finishEnrollment();
 }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
async function copySecret(){if(setupSecret.value && navigator.clipboard)await navigator.clipboard.writeText(setupSecret.value);}
async function copyRecovery(){if(recoveryCodes.value.length && navigator.clipboard)await navigator.clipboard.writeText(recoveryCodes.value.join('\n'));}
function finishEnrollment(){
 recoveryCodes.value=[];setupSecret.value='';setupUri.value='';
 ['access_token','auth_token','auth-token','user'].forEach(key=>localStorage.removeItem(key));
 router.replace('/login');
}
onMounted(refresh);
</script>
<style scoped>
.security-page{min-height:100vh;background:#f4f7fb;color:#17243a;padding:32px;display:grid;gap:20px;align-content:start}.page-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.eyebrow{font-size:11px;letter-spacing:.09em;color:#315ac4;font-weight:800}.page-header h1{font-size:29px;margin:6px 0}.page-header p:not(.eyebrow),.muted{font-size:13px;line-height:1.7;color:#65748b}.back-link{color:#315ac4;text-decoration:none;padding:10px 12px;background:#edf2fe;border-radius:9px;font-size:12px;font-weight:750}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.metrics article,.card{padding:24px;background:#fff;border:1px solid #e4eaf4;border-radius:15px;min-width:0}.metrics article{display:grid;gap:8px}.metrics small{color:#64748b;font-size:12px}.metrics strong{font-size:21px}.card h2{font-size:19px;margin:0 0 10px}.card form{max-width:620px;display:grid;gap:14px;margin-top:22px}label{font-size:12px;font-weight:750;display:grid;gap:8px}input:not([type=checkbox]){font:inherit;font-size:13px;width:100%;border-radius:9px;background:#f8faff;border:1px solid #d7e1ee;color:#223c5e;padding:13px}button{font:inherit;font-size:12px;font-weight:750;padding:12px 16px;border:0;border-radius:9px;color:#fff;background:#315ac4;cursor:pointer;width:max-content}button:disabled{opacity:.5;cursor:not-allowed}.secondary{background:#edf2fd;color:#315ac4}.danger{background:#b03754}.setup-details{display:grid;gap:12px;background:#f6f9fe;border-radius:12px;padding:16px}.setup-details strong{font-size:14px}.setup-details p{font-size:12px;color:#65748b}.secret-wrap{display:flex;gap:10px;align-items:center;flex-wrap:wrap}code{background:#eaf0fc;color:#183d8b;word-break:break-all;border-radius:8px;padding:11px;font-size:12px}.uri{display:block;max-height:100px;overflow:auto;margin-top:9px}.codes{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;max-width:460px;margin:18px 0}.codes code{text-align:center;letter-spacing:.07em;font-weight:750}.recovery-card{border-color:#b8c8ed}.confirm-save{display:flex;gap:10px;align-items:center;margin:15px 0}.notice{padding:13px;border-radius:9px;font-size:13px}.notice.error{background:#ffe7ed;color:#ac3852}.notice.success{background:#e5f7ec;color:#157350}
@media(max-width:800px){.security-page{padding:17px}.page-header{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr}.codes{grid-template-columns:1fr 1fr}}
</style>