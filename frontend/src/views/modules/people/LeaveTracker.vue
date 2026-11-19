<template>
  <main class="leave-screen">
    <header class="header"><div><p class="eyebrow">PEOPLE OPERATIONS / LEAVE TRACKER</p><h1>Leave tracker</h1><p>Request leave and track decisions.</p></div>
      <button ref="requestTrigger" type="button" class="pmo-control primary" @click="composeOpen=true">Request leave</button>
    </header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p><p v-if="success" class="message" role="status">{{ success }}</p>
    <div class="summary">
      <section><span>Annual leave available</span><strong>{{ balance?.remaining?.ANNUAL ?? '—' }}</strong><small>Weekdays remaining this year</small></section>
      <section><span>Medical leave available</span><strong>{{ balance?.remaining?.MEDICAL ?? '—' }}</strong><small>Approved entitlement remaining</small></section>
    </div>
    <p v-if="balanceLoading" role="status">Updating leave balances…</p>
    <p v-if="balanceError" role="alert">{{ balanceError }}{{ balance ? ' Showing the last available balance.' : '' }} <button type="button" class="pmo-control" @click="loadBalance">Retry balances</button></p>
        <PremiumComposeDialog :open="composeOpen" title="New leave request" eyebrow="PEOPLE / LEAVE" description="Choose your dates and prepare a clear handover before requesting approval." :error="error" @close="closeRequest">
        <p v-if="original" class="notice">Revising a returned request. <strong v-if="original.comment">Checker: {{ original.comment }}</strong></p>
        <form id="leave-request-form" @submit.prevent="submit">
          <label for="leave-type">Leave type</label><SmartSelect id="leave-type" v-model="type" aria-label="Leave type" :options="[{value:'ANNUAL',label:'Annual leave'},{value:'MEDICAL',label:'Medical leave'},{value:'EMERGENCY',label:'Emergency leave'},{value:'UNPAID',label:'Unpaid leave'}]" />
          <div class="date-grid">
            <div><label for="leave-start">Start date</label><SmartDatePicker id="leave-start" v-model="startDate" aria-label="Start date" required /></div>
            <div><label for="leave-end">End date</label><SmartDatePicker id="leave-end" v-model="endDate" aria-label="End date" :min="startDate" required /></div>
          </div>
          <label for="leave-day-type">Leave duration</label>
          <SmartSelect id="leave-day-type" v-model="dayType" aria-label="Leave duration" :options="[{value:'FULL',label:'Full working day(s)'},{value:'AM',label:'Morning half day (single date)'},{value:'PM',label:'Afternoon half day (single date)'}]" />
          <label for="leave-reason">Reason and handover (required)</label>
          <p id="leave-reason-help">Use 3–500 characters. Include coverage details where relevant.</p>
          <textarea id="leave-reason" aria-describedby="leave-reason-help" v-model.trim="reason" rows="4" minlength="3" maxlength="500" required placeholder="Reason and coverage plan"></textarea>
          <p v-if="previewMessage" role="status">{{ previewMessage }}</p>
        </form>
        <template #footer>
          <button type="button" class="pmo-control" @click="closeRequest">Cancel</button>
          <button type="submit" form="leave-request-form" class="pmo-control primary" :disabled="busy || !startDate || !endDate || reason.length < 3 || Boolean(previewError)">{{ busy ? 'Submitting…' : 'Submit for review' }}</button>
        </template>
        </PremiumComposeDialog>
      <section class="card">
        <div class="section-header"><h2>My leave requests</h2><button class="secondary" :disabled="loading" @click="loadRequests">Refresh requests</button></div>
        <ul v-if="requestsLoaded" class="request-counts">
          <li class="pmo-status">Pending {{ pendingCount }}</li>
          <li class="pmo-status">Approved {{ approvedCount }}</li>
          <li class="pmo-status">Returned or rejected {{ declinedCount }}</li>
        </ul>
        <p v-if="loading" role="status">Updating your leave requests…</p>
        <p v-if="requestsError" role="alert">{{ requestsError }}{{ requestsLoaded ? ' Showing the last available requests.' : '' }} Use Refresh requests to try again.</p>
        <p v-if="requestsLoaded && !loading && !requests.length">No leave requests yet.</p>
        <div v-if="requests.length" class="requests"><article v-for="item in requests" :key="item.id" class="request">
          <div class="request-title"><strong>{{ format(item.type) }}</strong><span class="pill" :class="item.status.toLowerCase()">{{ item.status }}</span></div>
          <div class="date-text">{{ item.startDate }} → {{ item.endDate }} · {{ item.dayType === 'FULL' ? 'Full day' : item.dayType === 'AM' ? 'Morning half' : 'Afternoon half' }}</div>
          <small>{{ item.reason }}</small>
          <router-link v-if="item.status === 'RETURNED'" class="pmo-control quiet" :to="{name:'LeaveApprovals',params:{requestId:item.id}}">View decision</router-link>
          <p class="checker">Checker: {{ item.checkerId ? item.checkerId.slice(0, 8) : 'Awaiting assignment' }}</p>
          <button v-if="item.status === 'PENDING'" type="button" class="cancel-action"
            :disabled="busy" @click="cancelRequest(item)">Cancel pending request</button>
        </article></div>
      </section>
  </main>
</template>
<script setup>
import SmartDatePicker from "../../../components/SmartDatePicker.vue";
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from '../../../api/axiosConfig';
import SmartSelect from '../../../components/SmartSelect.vue';
import PremiumComposeDialog from '../../../components/PremiumComposeDialog.vue';
const route = useRoute();
const composeOpen = ref(false);
const original = ref(null);
const requestTrigger = ref(null);
async function closeRequest() {
  composeOpen.value = false;
  if (original.value) {
    startDate.value='';endDate.value='';reason.value='';type.value='ANNUAL';dayType.value='FULL';
    original.value = null;
  }
  await nextTick();
  requestTrigger.value?.focus();
}
watch(() => route.query.request, request => {
  if (request === '1') composeOpen.value = true;
}, { immediate: true });
const type=ref('ANNUAL'),startDate=ref(''),endDate=ref(''),reason=ref(''),dayType=ref('FULL');
const loading=ref(false),busy=ref(false),error=ref(''),success=ref(''),requests=ref([]),balance=ref(null);
const requestsLoaded = ref(false), requestsError = ref('');
const balanceLoading = ref(false), balanceError = ref('');
const preview = computed(() => {
  if (!startDate.value || !endDate.value) return null;
  const first = Date.parse(startDate.value);
  const last = Date.parse(endDate.value);
  const day = 86_400_000;
  if (last < first) return { error: 'End date must be on or after the start date.' };
  if (last - first > 60 * day) return { error: 'Contact HR for leave longer than 60 days.' };
  if (first !== last && dayType.value !== 'FULL') return { error: 'Half-day leave must start and end on the same date.' };
  if (!balance.value) return null;
  const holidays = new Set(balance.value.holidays);
  let count = 0;
  for (let stamp = first; stamp <= last; stamp += day) {
    const date = new Date(stamp);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(date.toISOString().slice(0, 10))) count++;
  }
  const days = dayType.value === 'FULL' ? count : count / 2;
  if (!days) return { error: 'Select at least one working day. Weekends and organization holidays are excluded.' };
  const remaining = balance.value.remaining[type.value];
  const year = String(balance.value.year);
  const inBalanceYear = startDate.value.startsWith(year) && endDate.value.startsWith(year);
  if (inBalanceYear && remaining !== undefined && days > remaining) return { error: 'This request exceeds your available leave balance.' };
  return { days, remaining: inBalanceYear && remaining !== undefined ? remaining - days : null };
});
const previewError = computed(() => preview.value?.error || '');
const previewMessage = computed(() => {
  if (previewError.value) return previewError.value;
  if (!preview.value) return '';
  const { days, remaining } = preview.value;
  return 'Uses ' + days + ' working ' + (days === 1 ? 'day' : 'days') +
    (remaining === null ? '.' : ' · ' + remaining + ' days remaining if approved.');
});
const pendingCount=computed(()=>requests.value.filter(v=>v.status==='PENDING').length);
const approvedCount=computed(()=>requests.value.filter(v=>v.status==='APPROVED').length);
const declinedCount=computed(()=>requests.value.filter(v=>['REJECTED','RETURNED'].includes(v.status)).length);
const format=v=>String(v).replaceAll('_',' ').toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
function describe(e){const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Operation failed';}
async function loadRequests() {
  if (loading.value) return;
  loading.value = true;
  requestsError.value = '';
  try {
    requests.value = (await axios.get('/leave/mine')).data.data;
    requestsLoaded.value = true;
  } catch {
    requestsError.value = 'Could not load your leave requests.';
  } finally {
    loading.value = false;
  }
}
async function loadBalance() {
  if (balanceLoading.value) return;
  balanceLoading.value = true;
  balanceError.value = '';
  try {
    balance.value = (await axios.get('/leave/balances')).data.data;
  } catch {
    balanceError.value = 'Could not load leave balances.';
  } finally {
    balanceLoading.value = false;
  }
}
async function load() {
  await Promise.all([loadRequests(), loadBalance()]);
}
async function submit(){if (busy.value || previewError.value) return;error.value='';success.value='';busy.value=true;try{
  await axios.post('/leave',{type:type.value,startDate:startDate.value,endDate:endDate.value,reason:reason.value,dayType:dayType.value,...(original.value ? {revisesRequestId:original.value.id} : {})});
  success.value='Request submitted for independent approval. Your balance is not reduced while pending.';
  startDate.value='';endDate.value='';reason.value='';original.value=null;composeOpen.value=false;await load();
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
async function loadRevision(id) {
  if (typeof id !== 'string' || !id) return;
  try {
    const { data } = await axios.get('/reviews', { params:{module:'leave',id} });
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    const request = data.data.find(item => item.kind === 'LEAVE_REQUEST' && item.status === 'RETURNED' && item.makerId === userId);
    const proposed = request?.proposed;
    if (!proposed) throw new Error('The returned leave request could not be loaded.');
    original.value = request; type.value = proposed.type; startDate.value = proposed.startDate;
    endDate.value = proposed.endDate; reason.value = proposed.reason; dayType.value = proposed.dayType || 'FULL';
    composeOpen.value = true;
  } catch (cause) { error.value = describe(cause); }
}
watch(() => route.query.revise, loadRevision, { immediate:true });
onMounted(load);
</script>
<style scoped>
.cancel-action{background:#fff1f3!important;color:#ad3451!important;border:1px solid #f4cbd5!important;justify-self:start}
.module-shortcuts{display:flex;gap:9px;flex-wrap:wrap}
.leave-screen{padding:34px;background:var(--pmo-accent-soft);min-height:100vh;display:grid;gap:22px;align-content:start;color:var(--pmo-text)}.header{display:flex;justify-content:space-between;align-items:center;gap:16px}.header h1{font-size:30px;margin:5px 0}.header p:not(.eyebrow){font-size:14px;color:#64748b}.eyebrow{font-size:11px;color:var(--pmo-accent-ink);font-weight:800;letter-spacing:.09em}.heading-link,.related a{border-radius:9px;padding:11px 15px;text-decoration:none;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);font-size:12px;font-weight:750}.summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:15px}.summary section,.card{background:#fff;border:1px solid var(--pmo-border);border-radius:15px;padding:24px}.summary section{display:grid;gap:8px}.summary span,.summary small{color:#64748b;font-size:12px}.summary strong{font-size:29px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}.card h2{font-size:19px;margin:0 0 12px}.card>p{color:#64748b;font-size:13px}.card form{display:grid;gap:13px;margin-top:22px}label{font-weight:700;color:var(--pmo-text);font-size:12px;display:block;margin-bottom:7px}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}input,select,textarea{font:inherit;font-size:13px;color:var(--pmo-text);width:100%;border-radius:9px;border:1px solid var(--pmo-border);background:var(--pmo-accent-soft);padding:12px}button{background:var(--pmo-accent);color:var(--pmo-on-accent);font-size:12px;font-weight:750;cursor:pointer;border:0;border-radius:9px;padding:12px 17px}button:disabled{opacity:.5}button.secondary{background:var(--pmo-accent-soft);color:var(--pmo-accent-ink)}.section-header,.request-title{display:flex;justify-content:space-between;align-items:center;gap:10px}.requests{display:grid;gap:11px;margin-top:17px}.request{border:1px solid var(--pmo-border);border-radius:12px;padding:15px;background:var(--pmo-accent-soft);display:grid;gap:8px}.request small,.date-text,.checker{color:#64748b;font-size:12px}.checker{margin:0}.pill{border-radius:20px;background:var(--pmo-accent-soft);color:#53647c;padding:6px 10px;font-size:10px;font-weight:750}.pill.pending{background:#fff3d9;color:#a16b19}.pill.approved{background:#e0f6ed;color:#187958}.pill.rejected{background:#ffe8ed;color:#ae3753}.related{display:flex;flex-wrap:wrap;gap:10px;margin-top:15px}.message{background:#e4f8ed;color:#147254;padding:12px;border-radius:9px}.message.error{background:#ffe6ec;color:#a62e49}
@media(max-width:1200px){.summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:850px){.columns{grid-template-columns:1fr}.leave-screen{padding:18px}}@media(max-width:580px){.summary{grid-template-columns:1fr}.date-grid{grid-template-columns:1fr}.header{align-items:flex-start;flex-direction:column}}
.leave-screen .summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.leave-screen .summary section{min-inline-size:0;padding:16px}
.request-counts{display:flex;flex-wrap:wrap;gap:8px;margin-block:12px;padding:0;list-style:none}
@media(max-width:580px){.leave-screen .header .primary{inline-size:100%}}
</style>
