<template>
  <div class="profile-overlay" @mousedown.self="emit('close')" @keydown.esc.stop="emit('close')">
    <section ref="dialog" class="profile-modal" role="dialog" aria-modal="true"
      aria-labelledby="profile-modal-heading" tabindex="-1">
      <header class="profile-head">
        <div class="profile-title">
          <span class="profile-avatar"><img v-if="profile.avatarDataUrl" :src="profile.avatarDataUrl" alt="Profile picture" />{{ profile.avatarDataUrl ? '' : initials }}</span>
          <div><p class="profile-eyebrow">ACCOUNT / PERSONAL SETTINGS</p>
            <h2 id="profile-modal-heading">Profile management</h2>
            <p>Manage your account information and credentials.</p></div>
        </div>
        <button type="button" class="close-modal" aria-label="Close profile management" @click="emit('close')">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <div class="profile-content">
        <p v-if="error" class="profile-message error" role="alert">{{ error }}</p>
        <p v-if="notice" class="profile-message success" role="status">{{ notice }}</p>
        <p v-if="loading" role="status">Loading profile…</p>
        <template v-else>
          <div class="work-actions profile-navigation" role="group" aria-label="Account settings section">
            <button v-for="item in ['Profile','Appearance','Security']" :key="item" type="button" class="pmo-control quiet" :aria-pressed="section===item" @click="section=item">{{ item }}</button>
          </div>
          <section v-show="section==='Profile'" class="profile-section avatar-section">
            <div class="section-heading"><h3>Profile photo</h3><p>Use a square, clear photo for your workspace identity.</p></div>
            <label for="profile-photo">Upload profile picture (PNG, JPEG or WebP)</label>
            <input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" @change="uploadAvatar" />
            <p class="profile-hint">The image is optimized before uploading. Maximum stored size: 150 KB.</p>
          </section>
          <form v-show="section==='Profile'" id="save-profile-form" class="profile-section" @submit.prevent="saveProfile">
            <div class="section-heading"><h3>Personal information</h3><p>Your name appears throughout the PMO workspace.</p></div>
            <label for="profile-name">Full name</label>
            <input id="profile-name" v-model.trim="name" minlength="2" maxlength="140" autocomplete="name" required/>
            <label for="profile-email">Email address</label>
            <input id="profile-email" :value="profile.email" type="email" disabled />
            <p class="profile-hint">Email address changes require a separate verification workflow.</p>
            <div class="profile-grid">
              <div><span>Organization</span><strong>{{ profile.organization || '—' }}</strong></div>
              <div><span>Workspace role</span><strong>{{ formatRole(profile.role) }}</strong></div>
              <div><span>Department</span><strong>{{ profile.department || 'Not assigned' }}</strong></div>
              <div><span>Account created</span><strong>{{ profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—' }}</strong></div>
              <div><span>Email verification</span><strong>{{ profile.emailVerifiedAt ? 'Verified' : 'Pending' }}</strong></div>
              <div><span>Organization ID</span><strong class="long-value">{{ profile.organizationId || '—' }}</strong></div>
            </div>
          </form>
          <section v-show="section==='Appearance'" class="profile-section appearance-section">
            <div class="section-heading"><h3>Appearance</h3><p>Your theme follows you across modules and devices after sign-in.</p></div>
            <fieldset class="appearance-fieldset"><legend>Display mode</legend>
              <div class="appearance-options">
                <button v-for="mode in modes" :key="mode.value" type="button" :disabled="busy" :aria-pressed="appearance.themeMode === mode.value" @click="chooseAppearance('themeMode',mode.value)">
                  <span class="material-symbols-outlined" aria-hidden="true">{{ mode.icon }}</span>{{ mode.label }}
                </button>
              </div>
            </fieldset>
            <fieldset class="appearance-fieldset"><legend>Accent color</legend>
              <div class="accent-options">
                <button v-for="accent in accents" :key="accent.value" type="button" :disabled="busy" :aria-pressed="appearance.accentColor === accent.value" :aria-label="accent.label" :title="accent.label" @click="chooseAppearance('accentColor',accent.value)">
                  <span class="accent-swatch" :style="{ background: accent.color }"><span v-if="appearance.accentColor === accent.value" class="material-symbols-outlined" aria-hidden="true">check</span></span>
                  <small>{{ accent.label }}</small>
                </button>
              </div>
            </fieldset>
            <p class="profile-hint">Changes preview instantly. Save to keep them on your account.</p>
          </section>
          <form v-show="section==='Security'" id="change-password-form" class="profile-section" @submit.prevent="changePassword">
            <div class="section-heading"><h3>Change password</h3><p>For security, changing your password signs out other sessions and this device.</p></div>
            <label for="profile-current-password">Current password</label>
            <input id="profile-current-password" v-model="currentPassword" type="password" autocomplete="current-password" required />
            <label for="profile-new-password">New password</label>
            <input id="profile-new-password" v-model="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
            <label for="profile-confirm-password">Confirm new password</label>
            <input id="profile-confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
          </form>
        </template>
      </div>
      <footer class="profile-foot">
        <button type="button" class="pmo-control quiet" @click="emit('close')">Close</button>
        <template v-if="!loading">
          <button v-if="section==='Profile'" type="submit" form="save-profile-form" class="pmo-control primary" :disabled="busy || !name || name===profile.name">Save changes</button>
          <button v-else-if="section==='Appearance'" type="button" class="pmo-control primary" :disabled="busy || !appearanceDirty" @click="saveAppearancePreferences">Save appearance</button>
          <button v-else type="submit" form="change-password-form" class="pmo-control" :disabled="busy || !currentPassword || newPassword.length<12 || !confirmPassword">Update password</button>
        </template>
      </footer>
    </section>
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import axios from '../../../api/axiosConfig';
import { applyAppearance, saveAppearance, APPEARANCE_MODES, ACCENT_COLORS } from '../../../utils/appearance';
const section = ref('Profile');
const emit=defineEmits(['close','updated','password-changed']);
const dialog=ref(null),profile=ref({}),name=ref(''),loading=ref(true),busy=ref(false),error=ref(''),notice=ref('');
const currentPassword=ref(''),newPassword=ref(''),confirmPassword=ref('');
const appearance=ref({themeMode:'system',accentColor:'blue'});
const savedAppearance=ref({themeMode:'system',accentColor:'blue'});
const modes=[{value:'system',label:'System',icon:'devices'},{value:'light',label:'Light',icon:'light_mode'},{value:'dark',label:'Dark',icon:'dark_mode'}].filter(x=>APPEARANCE_MODES.includes(x.value));
const accents=[{value:'blue',label:'Blue',color:'#0071E3'},{value:'graphite',label:'Graphite',color:'#667085'},{value:'purple',label:'Purple',color:'#805AD5'},{value:'teal',label:'Teal',color:'#158C8C'},{value:'green',label:'Green',color:'#26865E'},{value:'rose',label:'Rose',color:'#CA647C'}].filter(x=>ACCENT_COLORS.includes(x.value));
const appearanceDirty=computed(()=>appearance.value.themeMode!==savedAppearance.value.themeMode || appearance.value.accentColor!==savedAppearance.value.accentColor);
function chooseAppearance(key,value){appearance.value={...appearance.value,[key]:value};applyAppearance(appearance.value);}
async function saveAppearancePreferences(){busy.value=true;error.value='';notice.value='';
  try{const updated=(await axios.patch('/profile/appearance',appearance.value)).data.data;
    const clean=saveAppearance(profile.value.id,updated);appearance.value={...clean};savedAppearance.value={...clean};
    profile.value={...profile.value,...updated};emit('updated',updated);notice.value='Appearance preferences saved.';
  }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
function restoreUnsavedAppearance(){if(appearanceDirty.value)applyAppearance(savedAppearance.value);}

const initials=computed(()=>String(name.value||profile.value.email||'PM').split(/[\s@.]+/).slice(0,2).map(x=>x.slice(0,1).toUpperCase()).join(''));
const formatRole=value=>String(value||'MEMBER').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const describe=e=>{const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Unable to update profile';};
async function load(){
  loading.value=true;error.value='';
  try{profile.value=(await axios.get('/profile')).data.data;name.value=profile.value.name;
    savedAppearance.value={themeMode:profile.value.themeMode||'system',accentColor:profile.value.accentColor||'blue'};
    appearance.value={...savedAppearance.value};applyAppearance(appearance.value);}
  catch(e){error.value=describe(e);}finally{loading.value=false;}
}
async function saveProfile(){
  busy.value=true;error.value='';notice.value='';
  try{
    const updated=(await axios.patch('/profile',{name:name.value})).data.data;
    profile.value={...profile.value,...updated};name.value=updated.name;
    notice.value='Profile updated successfully.';
    emit('updated',updated);
  }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
async function uploadAvatar(event){
  const file=event.target.files?.[0];if(!file)return;
  error.value='';notice.value='';
  if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>5*1024*1024){error.value='Choose a PNG, JPEG or WebP smaller than 5 MB.';return;}
  busy.value=true;
  try{
    const image=await createImageBitmap(file);
    const scale=Math.min(1,320/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Image processing unavailable');
    context.drawImage(image,0,0,canvas.width,canvas.height);image.close();
    let dataUrl=canvas.toDataURL('image/jpeg',.78);
    if(dataUrl.length>200000)dataUrl=canvas.toDataURL('image/jpeg',.5);
    if(dataUrl.length>200000)throw new Error('Image is still too large. Choose a smaller picture.');
    const updated=(await axios.post('/profile/avatar',{dataUrl})).data.data;
    profile.value={...profile.value,...updated};notice.value='Profile picture updated.';emit('updated',updated);
  }catch(e){error.value=describe(e);}finally{busy.value=false;event.target.value='';}
}
async function changePassword(){
  error.value='';notice.value='';
  if(newPassword.value!==confirmPassword.value){error.value='New passwords do not match.';return;}
  if(newPassword.value.length<12){error.value='Password must have at least 12 characters.';return;}
  busy.value=true;
  try{
    await axios.post('/profile/change-password',{currentPassword:currentPassword.value,newPassword:newPassword.value});
    currentPassword.value='';newPassword.value='';confirmPassword.value='';
    emit('password-changed');
  }catch(e){error.value=describe(e);}finally{busy.value=false;}
}
onMounted(async()=>{await nextTick();dialog.value?.focus();await load();});
onUnmounted(restoreUnsavedAppearance);
</script>
<style scoped>
.profile-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#10213e99;backdrop-filter:blur(3px)}
.profile-modal{background:#fff;border-radius:20px;border:1px solid var(--pmo-border);width:min(100%,740px);max-height:min(90dvh,820px);overflow:hidden;display:flex;flex-direction:column;color:var(--pmo-text);box-shadow:0 25px 70px color-mix(in srgb, var(--pmo-accent) 25%, transparent);outline:0}
.profile-head{display:flex;justify-content:space-between;gap:14px;padding:26px 28px 20px;border-bottom:1px solid var(--pmo-border)}
.profile-title{display:flex;align-items:center;gap:14px}
 .profile-avatar img{height:100%;width:100%;border-radius:50%;object-fit:cover}.long-value{overflow-wrap:anywhere}
.profile-avatar{height:50px;width:50px;display:grid;place-items:center;border-radius:50%;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);font-weight:800;flex:none}
.profile-eyebrow{font-size:10px;color:var(--pmo-muted);letter-spacing:.08em;font-weight:800;margin:0 0 5px}
.profile-head h2{font-size:21px;font-weight:750;margin:0}
.profile-head p:not(.profile-eyebrow){font-size:12px;color:#65758b;margin:7px 0 0}
.close-modal{border:0;background:var(--pmo-accent-soft);color:#476078;height:34px;width:34px;border-radius:10px;cursor:pointer;display:grid;place-items:center;flex:none}
.close-modal .material-symbols-outlined{font-size:19px}
.profile-content{overflow-y:auto;overscroll-behavior:contain;padding:22px 28px;min-height:0}
.profile-section{display:grid;gap:10px;padding:5px 0 24px}
.profile-section+.profile-section{border-top:1px solid var(--pmo-border);padding-top:24px}
.section-heading h3{font-size:16px;margin:0 0 6px;font-weight:750}
.section-heading p,.profile-hint{font-size:12px;line-height:1.55;color:#6c7b92;margin:0 0 10px}
.profile-section label{font-size:12px;font-weight:750;color:var(--pmo-text)}
.profile-section input{border:1px solid var(--pmo-border);border-radius:10px;padding:12px 13px;background:var(--pmo-accent-soft);color:var(--pmo-text);font-size:13px;width:100%}
.profile-section input:disabled{background:var(--pmo-accent-soft);color:#78889d;cursor:not-allowed}
.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.profile-grid>div{background:var(--pmo-accent-soft);border-radius:10px;padding:13px;display:grid;gap:6px}
.profile-grid span{color:#7d8aa0;font-size:11px}
.profile-grid strong{font-size:13px;font-weight:700}
.profile-actions{display:flex;justify-content:flex-end;margin-top:8px}
.profile-modal button:not(.close-modal){border:0;padding:11px 16px;background:var(--pmo-accent);color:var(--pmo-on-accent);border-radius:9px;font-size:12px;font-weight:750;cursor:pointer}
.profile-modal button.secondary{background:var(--pmo-accent-soft);color:var(--pmo-accent-ink)}
.profile-modal button:disabled{opacity:.5;cursor:not-allowed}
.profile-message{border-radius:9px;padding:12px;font-size:12px;margin:0 0 14px}
.profile-message.error{background:#ffe8ed;color:#a82e48}
.profile-message.success{background:#e4f6eb;color:#14784c}
.profile-foot{padding:15px 28px;border-top:1px solid var(--pmo-border);display:flex;justify-content:flex-end}
@media(max-width:600px){.profile-overlay{padding:10px}.profile-head{padding:20px}.profile-content{padding:18px 20px}.profile-foot{padding:14px 20px}.profile-grid{grid-template-columns:1fr}}
.appearance-fieldset{padding:0;margin:8px 0 12px;border:0}.appearance-fieldset legend{font-size:12px;font-weight:750;margin-bottom:10px;color:var(--pmo-text,var(--pmo-text))}
.appearance-options,.accent-options{display:flex;flex-wrap:wrap;gap:10px}.profile-modal .appearance-options button{display:flex;align-items:center;gap:9px;padding:12px 17px!important;background:var(--pmo-surface-alt,var(--pmo-accent-soft))!important;color:var(--pmo-text,var(--pmo-text))!important;border:1px solid var(--pmo-border,var(--pmo-border))!important}
.profile-modal .appearance-options button[aria-pressed=true]{border:2px solid var(--pmo-accent,var(--pmo-accent))!important;color:var(--pmo-accent,var(--pmo-accent-ink))!important}.appearance-options .material-symbols-outlined{font-size:18px}.profile-modal .accent-options button{background:transparent!important;color:var(--pmo-text,var(--pmo-text))!important;display:grid;justify-items:center;padding:5px!important;gap:6px;border:0!important}.accent-swatch{height:39px;width:39px;border-radius:13px;display:grid;place-items:center;border:2px solid transparent}.accent-swatch .material-symbols-outlined{color:#fff;font-size:19px}.accent-options button[aria-pressed=true] .accent-swatch{outline:2px solid var(--pmo-accent,var(--pmo-accent-ink));outline-offset:3px}.accent-options small{font-size:10px}
</style>