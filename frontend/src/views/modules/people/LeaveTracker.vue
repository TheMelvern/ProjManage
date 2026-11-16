<template>
  <main class="leave-screen">
    <header class="header"><div><p class="eyebrow">PEOPLE OPERATIONS / LEAVE TRACKER</p><h1>Leave Tracker Management</h1><p>Request leave, monitor approvals and coordinate project availability.</p></div></header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p><p v-if="success" class="message" role="status">{{ success }}</p>
    <div class="summary">
      <section><span>Annual leave available</span><strong>{{ balance?.remaining?.ANNUAL ?? '—' }}</strong><small>Weekdays remaining this year</small></section>
      <section><span>Medical leave available</span><strong>{{ balance?.remaining?.MEDICAL ?? '—' }}</strong><small>Approved entitlement remaining</small></section>
      <section><span>Pending requests</span><strong>{{ pendingCount }}</strong><small>Awaiting independent check</small></section>
      <section><span>Approved requests</span><strong>{{ approvedCount }}</strong><small>Confirmed absences</small></section>
      <section><span>Rejected / returned</span><strong>{{ declinedCount }}</strong><small>See decisions in the Approvals tab</small></section>
    </div>
    <div class="columns">
      <section class="card">
        <h2>Apply for leave</h2><p>New requests are routed to an independent approver.</p>
        <form @submit.prevent="submit">
          <label for="leave-type">Leave type</label><SmartSelect id="leave-type" v-model="type" aria-label="Leave type" :options="[{value:'ANNUAL',label:'Annual leave'},{value:'MEDICAL',label:'Medical leave'},{value:'EMERGENCY',label:'Emergency leave'},{value:'UNPAID',label:'Unpaid leave'}]" />
          <div class="date-grid">
            <div><label for="leave-start">Start date</label><input id="leave-start" v-model="startDate" type="date" required /></div>
            <div><label for="leave-end">End date</label><input id="leave-end" v-model="endDate" type="date" :min="startDate" required /></div>
          </div>
          <label for="leave-day-type">Leave duration</label>
          <SmartSelect id="leave-day-type" v-model="dayType" aria-label="Leave duration" :options="[{value:'FULL',label:'Full working day(s)'},{value:'AM',label:'Morning half day (single date)'},{value:'PM',label:'Afternoon half day (single date)'}]" />
          <label for="leave-reason">Reason / handover details</label>
          <textarea id="leave-reason" v-model.trim="reason" rows="4" minlength="3" maxlength="500" required placeholder="Reason and coverage plan"></textarea>
          <button type="submit" :disabled="busy || !startDate || !endDate || !reason"> {{ busy ? 'Submitting…' : 'Submit for check' }} </button>
        </form>
      </section>
      <section class="card">
        <div class="section-header"><h2>My leave requests</h2><button class="secondary" @click="load">Refresh</button></div>
        <p v-if="loading">Loading your leave records…</p><p v-else-if="!requests.length">No leave applications yet.</p>
        <div v-else class="requests"><article v-for="item in requests" :key="item.id" class="request">
          <div class="request-title"><strong>{{ format(item.type) }}</strong><span class="pill" :class="item.status.toLowerCase()">{{ item.status }}</span></div>
          <div class="date-text">{{ item.startDate }} → {{ item.endDate }} · {{ item.dayType === 'FULL' ? 'Full day' : item.dayType === 'AM' ? 'Morning half' : 'Afternoon half' }}</div>
          <small>{{ item.reason }}</small>
          <p class="checker">Checker: {{ item.checkerId ? item.checkerId.slice(0, 8) : 'Awaiting assignment' }}</p>
          <button v-if="item.status === 'PENDING'" type="button" class="cancel-action"
            :disabled="busy" @click="cancelRequest(item)">Cancel pending request</button>
        </article></div>
      </section>
    </div>
  </main>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import axios from '../../../api/axiosConfig';
import SmartSelect from '../../../components/SmartSelect.vue';
const type=ref('ANNUAL'),startDate=ref(''),endDate=ref(''),reason=ref(''),dayType=ref('FULL');
const loading=ref(false),busy=ref(false),error=ref(''),success=ref(''),requests=ref([]),balance=ref(null);
const pendingCount=computed(()=>requests.value.filter(v=>v.status==='PENDING').length);
const approvedCount=computed(()=>requests.value.filter(v=>v.status==='APPROVED').length);
const declinedCount=computed(()=>requests.value.filter(v=>['REJECTED','RETURNED','CANCELLED'].includes(v.status)).length);
const format=v=>String(v).replaceAll('_',' ').toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
function describe(e){const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Operation failed';}
async function load(){error.value='';loading.value=true;try{const [mine,balances]=await Promise.all([axios.get('/leave/mine'),axios.get('/leave/balances')]);requests.value=mine.data.data;balance.value=balances.data.data;}catch(e){error.value=describe(e);}finally{loading.value=false;}}
async function submit(){error.value='';success.value='';busy.value=true;try{
  await axios.post('/leave',{type:type.value,startDate:startDate.value,endDate:endDate.value,reason:reason.value,dayType:dayType.value});
  success.value='Request submitted for independent approval. Your balance is not reduced while pending.';
  startDate.value='';endDate.value='';reason.value='';await load();
}catch(e){error.value=describe(e);}finally{busy.value=false;}}
async function cancelRequest(item) {
  if (!window.confirm('Cancel this pending leave request?')) return;
  busy.value = true; error.value = ''; success.value = '';
  try {
    await axios.post('/leave/' + encodeURIComponent(item.id) + '/cancel');
    success.value = 'Your pending leave request has been cancelled.';
    await load();
  } catch(e) { error.value = describe(e); }
  finally { busy.value = false; }
}
onMounted(load);
</script>
<style scoped>
.cancel-action{background:#fff1f3!important;color:#ad3451!important;border:1px solid #f4cbd5!important;justify-self:start}
.module-shortcuts{display:flex;gap:9px;flex-wrap:wrap}
.leave-screen{padding:34px;background:#f4f7fb;min-height:100vh;display:grid;gap:22px;align-content:start;color:#18253c}.header{display:flex;justify-content:space-between;align-items:center;gap:16px}.header h1{font-size:30px;margin:5px 0}.header p:not(.eyebrow){font-size:14px;color:#64748b}.eyebrow{font-size:11px;color:#315ac4;font-weight:800;letter-spacing:.09em}.heading-link,.related a{border-radius:9px;padding:11px 15px;text-decoration:none;background:#edf2fe;color:#315ac4;font-size:12px;font-weight:750}.summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:15px}.summary section,.card{background:#fff;border:1px solid #e6ebf3;border-radius:15px;padding:24px}.summary section{display:grid;gap:8px}.summary span,.summary small{color:#64748b;font-size:12px}.summary strong{font-size:29px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}.card h2{font-size:19px;margin:0 0 12px}.card>p{color:#64748b;font-size:13px}.card form{display:grid;gap:13px;margin-top:22px}label{font-weight:700;color:#30415a;font-size:12px;display:block;margin-bottom:7px}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}input,select,textarea{font:inherit;font-size:13px;color:#18253c;width:100%;border-radius:9px;border:1px solid #d9e1ee;background:#f7f9fd;padding:12px}button{background:#315ac4;color:#fff;font-size:12px;font-weight:750;cursor:pointer;border:0;border-radius:9px;padding:12px 17px}button:disabled{opacity:.5}button.secondary{background:#edf2fe;color:#315ac4}.section-header,.request-title{display:flex;justify-content:space-between;align-items:center;gap:10px}.requests{display:grid;gap:11px;margin-top:17px}.request{border:1px solid #e6ebf3;border-radius:12px;padding:15px;background:#fcfdff;display:grid;gap:8px}.request small,.date-text,.checker{color:#64748b;font-size:12px}.checker{margin:0}.pill{border-radius:20px;background:#edf1f6;color:#53647c;padding:6px 10px;font-size:10px;font-weight:750}.pill.pending{background:#fff3d9;color:#a16b19}.pill.approved{background:#e0f6ed;color:#187958}.pill.rejected{background:#ffe8ed;color:#ae3753}.related{display:flex;flex-wrap:wrap;gap:10px;margin-top:15px}.message{background:#e4f8ed;color:#147254;padding:12px;border-radius:9px}.message.error{background:#ffe6ec;color:#a62e49}
@media(max-width:1200px){.summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:850px){.columns{grid-template-columns:1fr}.leave-screen{padding:18px}}@media(max-width:580px){.summary{grid-template-columns:1fr}.date-grid{grid-template-columns:1fr}.header{align-items:flex-start;flex-direction:column}}
</style>
