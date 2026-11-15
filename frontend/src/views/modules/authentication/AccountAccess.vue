<template>
  <main class="account-screen">
    <section class="brand">
      <p class="eyebrow">PMO PORTAL / SECURE ACCESS</p>
      <h1>Your workspace, protected.</h1>
      <p>Account verification and recovery use short-lived, one-time links delivered to your registered email address.</p>
      <div class="brand-pill"><span class="material-symbols-outlined" aria-hidden="true">verified_user</span> Independent account governance</div>
    </section>
    <section class="account-card">
      <p class="eyebrow">ACCOUNT SECURITY</p>
      <h2>{{ title }}</h2><p class="intro">{{ intro }}</p>
      <p v-if="error" role="alert" class="notice error">{{ error }}</p>
      <p v-if="success" role="status" class="notice success">{{ success }}</p>
      <form v-if="mode==='forgot' || mode==='resend'" @submit.prevent="sendEmail">
        <label for="recovery-email">Work email</label>
        <input id="recovery-email" v-model.trim="email" type="email" autocomplete="email" required placeholder="name@company.com"/>
        <button type="submit" :disabled="busy">{{ busy?'Submitting…':mode==='forgot'?'Send password reset link':'Send verification link' }}</button>
      </form>
      <form v-else-if="mode==='reset'" @submit.prevent="reset">
        <p v-if="!token" class="notice error">The reset link is missing a token. Request a new link.</p>
        <label for="new-password">New password</label>
        <input id="new-password" v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required/>
        <label for="confirm-password">Confirm new password</label>
        <input id="confirm-password" v-model="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required/>
        <button type="submit" :disabled="busy || !token">{{ busy?'Resetting…':'Reset password' }}</button>
      </form>
      <form v-else @submit.prevent="verify">
        <p v-if="!token" class="notice error">The verification link is missing a token. Request another verification email.</p>
        <button type="submit" :disabled="busy || !token">{{ busy?'Verifying…':'Verify my email' }}</button>
      </form>
      <div class="account-links">
        <router-link to="/login">Back to sign in</router-link>
        <router-link v-if="mode!=='forgot'" to="/forgot-password">Forgot password?</router-link>
        <router-link v-if="mode!=='resend'" to="/resend-verification">Resend verification</router-link>
      </div>
    </section>
  </main>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '../../../api/axiosConfig';

const route=useRoute(),router=useRouter();
const mode=computed(()=>route.name==='ForgotPassword'?'forgot':
  route.name==='ResetPassword'?'reset':
    route.name==='ResendVerification'?'resend':'verify');
const titles={forgot:'Reset your password',reset:'Choose a new password',
  resend:'Resend verification',verify:'Verify your email'};
const descriptions={
  forgot:'Enter your registered work email. A reset link is sent if the account is eligible.',
  reset:'Choose a unique password of at least 12 characters. Existing sessions will be revoked.',
  resend:'After administrator approval, request a fresh verification email for your account.',
  verify:'Confirm your email ownership to activate your independently approved account.'
};
const title=computed(()=>titles[mode.value]),intro=computed(()=>descriptions[mode.value]);
const email=ref(''),password=ref(''),confirmation=ref(''),busy=ref(false),error=ref(''),success=ref('');
const token=computed(()=>typeof route.query.token==='string'?route.query.token:'');
function describe(e){const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Unable to complete the request';}
async function execute(path,payload){
  busy.value=true;error.value='';success.value='';
  try {
    const result=(await axios.post('/auth/'+path,payload)).data.data;
    success.value=result.message || (path==='verify-email'?'Email verified. You can now sign in.':
      path==='reset-password'?'Password reset. Sign in using the new password.':'Request submitted.');
    if(path==='verify-email'||path==='reset-password')await router.replace({path:route.path});
  }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
async function sendEmail(){await execute(mode.value==='forgot'?'request-password-reset':'resend-verification',{email:email.value});}
async function verify(){if(!token.value)return;await execute('verify-email',{token:token.value});}
async function reset(){
 if(password.value!==confirmation.value){error.value='Passwords do not match.';return;}
 if(!token.value)return;
 await execute('reset-password',{token:token.value,password:password.value});
 password.value='';confirmation.value='';
}
</script>
<style scoped>
.account-screen{min-height:100vh;display:grid;grid-template-columns:1fr 1.1fr;background:#f4f7fb;gap:24px;padding:48px;max-width:1500px;margin:auto;align-items:center;color:#16263f;font-family:Inter,system-ui,sans-serif}.brand{border-radius:22px;background:linear-gradient(145deg,#162a4a,#2e4379);padding:48px;color:#fff;min-height:510px;display:flex;flex-direction:column;justify-content:center}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.11em;color:#9db7ff}.brand h1{font-size:clamp(34px,4vw,52px);line-height:1.1;max-width:430px;margin:24px 0}.brand>p:not(.eyebrow){font-size:15px;line-height:1.8;color:#d3ddf2;max-width:430px}.brand-pill{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;background:#ffffff17;margin-top:40px;width:max-content;font-weight:750;font-size:12px}.account-card{border:1px solid #e2e9f3;background:white;padding:46px;border-radius:22px;max-width:590px;width:100%;margin:auto;box-shadow:0 18px 40px #1423440b}.account-card .eyebrow{color:#375dc3}.account-card h2{font-size:30px;margin:18px 0 11px}.intro{font-size:14px;line-height:1.6;color:#64748b;margin-bottom:30px}form{display:grid;gap:14px}label{font-size:12px;font-weight:750}input{font:inherit;font-size:13px;padding:14px;border:1px solid #d6e0ee;border-radius:10px;color:#263950;background:#f9fbfe;width:100%}input:focus-visible,button:focus-visible{outline:3px solid #a6bbf5;outline-offset:2px}button{border:0;background:#315ac4;border-radius:10px;padding:14px 17px;color:#fff;font-size:13px;font-weight:800;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}.account-links{display:flex;flex-wrap:wrap;gap:16px;margin-top:27px}.account-links a{color:#315ac4;font-size:12px;font-weight:750;text-decoration:none}.notice{border-radius:10px;padding:14px;font-size:13px;line-height:1.55}.notice.error{background:#ffedf1;color:#af3653}.notice.success{background:#e5f7ed;color:#147958}
@media(max-width:900px){.account-screen{grid-template-columns:1fr;padding:20px}.brand{min-height:200px;padding:25px}.brand h1{font-size:30px;margin:12px 0}.brand-pill{margin-top:12px}.account-card{padding:26px}}
</style>