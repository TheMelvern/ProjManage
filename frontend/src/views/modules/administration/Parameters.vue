<template>
  <main class="admin-page">
    <header><p class="eyebrow">ADMINISTRATION / PARAMETERS</p><h1>Admin Parameters</h1>
      <p>Organization configuration changes must pass independent review before becoming effective.</p></header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p><p v-if="notice" class="message" role="status">{{ notice }}</p>
    <section class="summary">
      <div><span>Approved parameters</span><strong>{{ rows.length }}</strong><small>Persisted by the organization</small></div>
      <div><span>Pending proposals</span><strong>{{ pending.length }}</strong><small>Awaiting a second administrator</small></div>
      <div><span>Configuration scope</span><strong>ORG</strong><small>Tenant-specific settings</small></div>
    </section>
    <div class="columns">
      <section class="card">
        <h2>Organization settings</h2><p>Submit proposed values for maker–checker approval.</p>
        <form @submit.prevent="submit">
          <label for="param-key">Parameter</label>
          <SmartSelect id="param-key" v-model="key" aria-label="Parameter" :options="allowed.map(k=>({value:k.key,label:k.name}))" />
          <label for="param-current">Current approved value</label>
          <input id="param-current" readonly :value="currentValue" placeholder="Not configured" />
          <label for="param-new">Proposed value</label>
          <input id="param-new" v-model.trim="value" maxlength="120" required />
          <label for="param-summary">Change rationale</label>
          <textarea id="param-summary" v-model.trim="summary" maxlength="400" rows="3" placeholder="Why is this parameter being changed?"></textarea>
          <button type="submit" :disabled="busy || !value"> {{ busy ? 'Submitting…' : 'Submit for check' }} </button>
        </form>
      </section>
      <section class="card">
        <h2>Approved master parameters</h2>
        <div v-if="loading">Loading parameter settings…</div>
        <p v-else-if="!rows.length">No parameters configured. Submit a proposal to begin.</p>
        <div v-else class="parameter-list">
          <div v-for="item in rows" :key="item.id"><strong>{{ title(item.key) }}</strong><span>{{ String(item.value) }}</span><small>Approved configuration</small></div>
        </div>
        <h2 class="pending-title">Pending proposals</h2>
        <p v-if="!pending.length">No pending changes.</p>
        <div v-else class="parameter-list"><div v-for="item in pending" :key="item.id">
          <strong>{{ item.summary }}</strong><span class="pending-pill">{{ item.status }}</span>
          <small>Proposed by {{ item.makerId?.slice(0,8) }}</small>
        </div></div>
      </section>
    </div>
  </main>
</template>
<script setup>
import SmartSelect from '../../../components/SmartSelect.vue';
import { computed, onMounted, ref } from 'vue';
import axios from '../../../api/axiosConfig';
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
const title=k=>allowed.find(x=>x.key===k)?.name||k;
const currentValue=computed(()=>String(rows.value.find(x=>x.key===key.value)?.value??''));
const pending=computed(()=>reviewRows.value.filter(x=>x.kind==='PARAMETER_UPDATE' && x.status==='PENDING'));
const describe=e=>{const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Unexpected error';};
async function load(){loading.value=true;error.value='';try{
  const [params,reviews]=await Promise.all([axios.get('/admin/parameters'),axios.get('/reviews')]);
  rows.value=params.data.data;reviewRows.value=reviews.data.data;
}catch(e){error.value=describe(e);}finally{loading.value=false;}}
async function submit(){error.value='';notice.value='';busy.value=true;try{
  await axios.post('/admin/parameters/proposals',{key:key.value,value:value.value,summary:summary.value || 'Update '+title(key.value)});
  notice.value='Change request created. A different administrator must approve it before the value changes.';
  value.value='';summary.value='';await load();
}catch(e){error.value=describe(e);}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.admin-crosslinks{display:flex;gap:10px;flex-wrap:wrap}.admin-crosslinks a{padding:11px 14px;background:#edf2fd;color:#315ac4;font-size:12px;font-weight:750;text-decoration:none;border-radius:9px}
.admin-page{padding:34px;background:#f4f7fb;min-height:100vh;color:#18253c;display:grid;gap:22px;align-content:start}header h1{font-size:30px;margin:5px 0}header p:not(.eyebrow){color:#64748b;font-size:14px}.eyebrow{font-size:11px;letter-spacing:.08em;color:#315ac4;font-weight:800}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.summary>div,.card{background:#fff;border:1px solid #e5ebf4;border-radius:15px;padding:24px}.summary>div{display:grid;gap:9px}.summary span,.summary small{color:#64748b;font-size:12px}.summary strong{font-size:29px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}.card h2{font-size:19px;margin:0 0 15px}.card p{font-size:13px;color:#64748b}.card form{display:grid;gap:12px;margin-top:18px}.card label{font-size:12px;font-weight:700;color:#30415a}input,select,textarea{font:inherit;font-size:13px;padding:12px 13px;border:1px solid #d9e1ee;border-radius:9px;background:#f7f9fd;width:100%;color:#18253c}button{background:#315ac4;color:white;border:0;border-radius:9px;padding:13px 17px;font-weight:750;font-size:12px;cursor:pointer}button:disabled{opacity:.5}.parameter-list{display:grid;gap:10px}.parameter-list>div{border:1px solid #edf0f5;background:#f9fbfe;padding:15px;border-radius:10px;display:grid;gap:8px}.parameter-list strong{font-size:13px}.parameter-list span{font-size:12px;color:#315ac4}.parameter-list small{font-size:11px;color:#64748b}.pending-title{margin-top:26px!important}.pending-pill{color:#94671d!important;background:#fff1d8;padding:5px 9px;border-radius:20px;width:max-content}.review-link,.linked a{display:inline-flex;text-decoration:none;font-size:12px;font-weight:750;color:#315ac4;background:#edf2fc;border-radius:9px;padding:10px 14px}.review-link{margin-top:22px}.linked{display:flex;gap:12px;flex-wrap:wrap}.message{padding:13px;border-radius:9px;background:#e3f8ed;color:#127454}.message.error{background:#ffe7ed;color:#af3651}
@media(max-width:850px){.columns{grid-template-columns:1fr}.admin-page{padding:20px}}@media(max-width:520px){.summary{grid-template-columns:1fr}}
</style>
