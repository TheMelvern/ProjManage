<template>
  <main class="admin-page">
    <header><p class="eyebrow">ADMINISTRATION / PARAMETERS</p><h1>Admin Parameters</h1>
      <p>Organization configuration changes must pass independent review before becoming effective.</p></header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p><p v-if="notice" class="message" role="status">{{ notice }}</p>
    <section class="work-panel settings-catalogue" aria-labelledby="catalogue-title">
      <header class="work-toolbar"><div><h2 id="catalogue-title">Organization settings</h2><p>Changes take effect after independent approval.</p></div></header>
      <div class="work-toolbar work-filters"><label for="parameter-search">Search settings</label><input id="parameter-search" v-model.trim="query" placeholder="Search by setting name" /></div>
      <p v-if="loading" class="work-panel-empty" role="status">Loading approved settings…</p>
      <p v-else-if="!settingGroups.length" class="work-panel-empty">No settings match your search.</p>
      <section v-for="group in settingGroups" :key="group.name" class="settings-group">
        <h3>{{ group.name }}</h3>
        <ul><li v-for="setting in group.items" :key="setting.key">
          <div><strong>{{ setting.name }}</strong><small>{{ loading ? 'Loading approved value…' : approvedValues[setting.key] ?? 'No approved override' }}</small></div>
          <button type="button" class="pmo-control quiet" :aria-label="'Propose change to ' + setting.name" @click="openSetting(setting.key)">Propose change</button>
        </li></ul>
      </section>
        <PremiumComposeDialog :open="composeOpen" title="Change organization parameter" eyebrow="ADMINISTRATION / PARAMETERS" description="Review the current approved value, enter a proposed value, and explain the reason." :error="error" @close="composeOpen=false">
        <form id="parameter-proposal-form" @submit.prevent="submit">
          <label for="param-key">Parameter</label>
          <SmartSelect id="param-key" v-model="key" aria-label="Parameter" :options="allowed.map(k=>({value:k.key,label:k.name}))" />
          <label for="param-current">Current approved value</label>
          <input id="param-current" readonly :value="currentValue" placeholder="Not configured" />
          <label for="param-new">Proposed value</label>
          <input id="param-new" v-model.trim="value" maxlength="120" required
            :list="key === 'timezone' ? 'time-zones' : undefined"
            :aria-describedby="key === 'timezone' ? 'time-zone-help' : undefined"
            :aria-invalid="invalidTimeZone || undefined" />
          <datalist id="time-zones"><option v-for="zone in timeZones" :key="zone" :value="zone" /></datalist>
          <p v-if="key === 'timezone'" id="time-zone-help" :role="invalidTimeZone ? 'status' : undefined">{{ invalidTimeZone ? 'Enter a valid time zone, such as Asia/Kuala_Lumpur.' : 'Search by region or city, or enter UTC.' }}</p>
          <label for="param-summary">Change rationale (required)</label>
          <textarea id="param-summary" v-model.trim="summary" required maxlength="400" rows="3" placeholder="Why is this parameter being changed?"></textarea>
        </form>
        <template #footer>
          <button type="button" class="pmo-control quiet" @click="composeOpen=false">Cancel</button>
          <button type="submit" form="parameter-proposal-form" class="pmo-control primary" :disabled="busy || !canSubmit">{{ busy ? 'Submitting…' : 'Submit for check' }}</button>
        </template>
        </PremiumComposeDialog>
    </section>
    <section class="work-panel">
      <header class="work-toolbar"><div><h2>Pending proposals</h2><p>Awaiting another administrator’s decision.</p></div></header>
      <p v-if="!pending.length" class="work-panel-empty">No pending proposals.</p>
      <ul v-else class="settings-proposals"><li v-for="item in pending" :key="item.id">
        <router-link class="queue-record" :to="{ name: 'AdminApprovals', params:{ requestId:item.id } }">{{ item.summary }}</router-link>
        <span class="record-state" data-state="PENDING">Pending review</span>
      </li></ul>
    </section>
  </main>
</template>
<script setup>
import SmartSelect from '../../../components/SmartSelect.vue';
import PremiumComposeDialog from '../../../components/PremiumComposeDialog.vue';
import { computed, onMounted, ref, watch } from 'vue';
import axios from '../../../api/axiosConfig';
const composeOpen = ref(false);
const query = ref('');
const allowed=[
{key:'timezone',name:'Organization time zone'},{key:'currency',name:'Reporting currency'},
{key:'dateFormat',name:'Date display format'},{key:'fiscalYearStart',name:'Fiscal year start'},
{key:'leaveApprovalSlaDays',name:'Leave approval SLA (days)'},
{key:'leaveAnnualEntitlement',name:'Annual leave entitlement (days)'},
{key:'leaveMedicalEntitlement',name:'Medical leave entitlement (days)'},
{key:'leavePublicHolidays',name:'Public holiday calendar (YYYY-MM-DD, comma-separated)'},
{key:'riskEscalationThreshold',name:'Risk escalation severity'},
{key:'sessionTimeoutMinutes',name:'Session idle timeout (minutes)'}
];
const key=ref(allowed[0].key),value=ref(''),summary=ref(''),rows=ref([]),reviewRows=ref([]),error=ref(''),notice=ref(''),loading=ref(false),busy=ref(false);
const timeZones = ['UTC', ...(Intl.supportedValuesOf?.('timeZone') || [])];
const invalidTimeZone = computed(() => {
  if (key.value !== 'timezone' || !value.value) return false;
  if (!/^(UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/i.test(value.value)) return true;
  try { new Intl.DateTimeFormat('en', { timeZone: value.value }); return false; }
  catch { return true; }
});
const canSubmit = computed(() => Boolean(value.value && summary.value && !invalidTimeZone.value));
watch(key, () => { value.value = ''; });
const title=k=>allowed.find(x=>x.key===k)?.name||k;
const approvedValues = computed(() => Object.fromEntries(rows.value.map(row => [row.key, String(row.value)])));
const settingGroups = computed(() => ['Organization', 'Leave', 'Reporting & risk'].map(name => ({
  name,
  items: allowed.filter(item => {
    const group = item.key.startsWith('leave') ? 'Leave' : ['currency', 'fiscalYearStart', 'riskEscalationThreshold'].includes(item.key) ? 'Reporting & risk' : 'Organization';
    return group === name && item.name.toLowerCase().includes(query.value.toLowerCase());
  })
})).filter(group => group.items.length));
function openSetting(setting) {
  key.value = setting;
  composeOpen.value = true;
}
const currentValue=computed(()=>String(rows.value.find(x=>x.key===key.value)?.value??''));
const pending=computed(()=>reviewRows.value.filter(x=>x.kind==='PARAMETER_UPDATE' && x.status==='PENDING'));
const describe=e=>{const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Unexpected error';};
async function load(){loading.value=true;error.value='';try{
  const [params,reviews]=await Promise.all([axios.get('/admin/parameters'),axios.get('/reviews')]);
  rows.value=params.data.data;reviewRows.value=reviews.data.data;
}catch(e){error.value=describe(e);}finally{loading.value=false;}}
async function submit(){if (busy.value || !canSubmit.value) return;error.value='';notice.value='';busy.value=true;try{
  await axios.post('/admin/parameters/proposals',{key:key.value,value:value.value,summary:summary.value});
  notice.value='Change request created. A different administrator must approve it before the value changes.';
  value.value='';summary.value='';composeOpen.value=false;await load();
}catch(e){error.value=describe(e);}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.admin-crosslinks{display:flex;gap:10px;flex-wrap:wrap}.admin-crosslinks a{padding:11px 14px;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);font-size:12px;font-weight:750;text-decoration:none;border-radius:9px}
.admin-page{padding:34px;background:var(--pmo-accent-soft);min-height:100vh;color:var(--pmo-text);display:grid;gap:22px;align-content:start}header h1{font-size:30px;margin:5px 0}header p:not(.eyebrow){color:#64748b;font-size:14px}.eyebrow{font-size:11px;letter-spacing:.08em;color:var(--pmo-accent-ink);font-weight:800}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.summary>div,.card{background:#fff;border:1px solid var(--pmo-border);border-radius:15px;padding:24px}.summary>div{display:grid;gap:9px}.summary span,.summary small{color:#64748b;font-size:12px}.summary strong{font-size:29px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}.card h2{font-size:19px;margin:0 0 15px}.card p{font-size:13px;color:#64748b}.card form{display:grid;gap:12px;margin-top:18px}.card label{font-size:12px;font-weight:700;color:var(--pmo-text)}input,select,textarea{font:inherit;font-size:13px;padding:12px 13px;border:1px solid var(--pmo-border);border-radius:9px;background:var(--pmo-accent-soft);width:100%;color:var(--pmo-text)}button{background:var(--pmo-accent);color:var(--pmo-on-accent);border:0;border-radius:9px;padding:13px 17px;font-weight:750;font-size:12px;cursor:pointer}button:disabled{opacity:.5}.parameter-list{display:grid;gap:10px}.parameter-list>div{border:1px solid var(--pmo-border);background:var(--pmo-accent-soft);padding:15px;border-radius:10px;display:grid;gap:8px}.parameter-list strong{font-size:13px}.parameter-list span{font-size:12px;color:var(--pmo-accent-ink)}.parameter-list small{font-size:11px;color:#64748b}.pending-title{margin-top:26px!important}.pending-pill{color:#94671d!important;background:#fff1d8;padding:5px 9px;border-radius:20px;width:max-content}.review-link,.linked a{display:inline-flex;text-decoration:none;font-size:12px;font-weight:750;color:var(--pmo-accent-ink);background:var(--pmo-accent-soft);border-radius:9px;padding:10px 14px}.review-link{margin-top:22px}.linked{display:flex;gap:12px;flex-wrap:wrap}.message{padding:13px;border-radius:9px;background:#e3f8ed;color:#127454}.message.error{background:#ffe7ed;color:#af3651}
@media(max-width:850px){.columns{grid-template-columns:1fr}.admin-page{padding:20px}}@media(max-width:520px){.summary{grid-template-columns:1fr}}
</style>
