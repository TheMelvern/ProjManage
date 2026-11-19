<template>
  <main class="review-page">
    <header class="review-heading">
      <div><p class="eyebrow">GOVERNANCE / FOUR-EYES CONTROL</p><h1 ref="routeHeading" tabindex="-1">{{ requestedId ? requestTitle : moduleLabel + ' approvals' }}</h1>
        <div v-if="selected" class="request-context"><span class="record-state" :data-state="selected.status">{{ labelKind(selected.status) }}</span>
          <span v-if="selected.status === 'PENDING'">Awaiting independent review</span></div>
        <router-link v-if="requestedId" class="pmo-control" :to="{name:$route.name}">Back to approvals</router-link>
        <p v-else>Review requests and decisions for this module.</p></div>
      <button class="pmo-control quiet" :disabled="loading" @click="load">{{ requestedId ? 'Refresh request' : 'Refresh queue' }}</button>
    </header>
    <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
    <p v-if="notice" class="feedback" role="status">{{ notice }}</p>
    <section v-if="!requestedId" class="review-card queue">
      <div class="section-title"><h2>Requests</h2><div class="work-actions"><label>Scope
        <SmartSelect v-model="scope" aria-label="Request scope" :options="[{value:'ALL',label:'All requests'},{value:'MINE',label:'My requests'},{value:'CHECK',label:'Needs my review'}]" />
      </label><label>Filter status
        <SmartSelect v-model="filter" aria-label="Approval status filter" :options="['ALL','PENDING','APPROVED','REJECTED','RETURNED'].map(x=>({value:x,label:x==='ALL'?'All':x.charAt(0)+x.slice(1).toLowerCase()}))" />
      </label></div></div>
      <div v-if="loading" role="status">Loading review requests…</div>
      <div v-else-if="error && !reviews.length" class="empty">Use Refresh queue to try again.</div>
      <div v-else-if="!filtered.length" class="empty">{{ scope === 'CHECK' && filter === 'ALL' ? 'No requests need your review.' : scope === 'MINE' && filter === 'ALL' ? 'You have no requests in this queue.' : 'No requests match this view.' }}</div>
      <template v-else>
      <ul class="review-mobile-list">
        <li v-for="review in filtered" :key="review.id">
          <router-link :to="{name:$route.name,params:{requestId:review.id}}">
            <strong>{{ review.summary }}</strong><span class="record-state" :data-state="review.status">{{ labelKind(review.status) }}</span>
            <small>{{ review.makerName || 'Applicant' }}</small><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </router-link>
        </li>
      </ul>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Approval requests table"><table><thead><tr><th>Reference</th><th>Module</th><th>Maker</th><th>Summary</th><th>Status</th><th>Checker</th><th>Action</th></tr></thead>
        <tbody><tr v-for="review in filtered" :key="review.id">
          <td class="mono">{{ review.id.slice(0,8) }}</td>
          <td>{{ labelKind(review.kind) }}</td>
          <td><span class="avatar">{{ initials(review.makerName) }}</span>{{ review.makerName || 'Applicant' }}</td>
          <td><router-link class="queue-record" :to="{name:$route.name,params:{requestId:review.id}}">{{ review.summary }}</router-link></td>
          <td><span class="record-state" :data-state="review.status">{{ labelKind(review.status) }}</span></td>
          <td><span v-if="review.checkerName" class="person"><span class="avatar">{{ initials(review.checkerName) }}</span>{{ review.checkerName }}</span><span v-else>—</span></td>
          <td><router-link class="pmo-control" :to="{name:$route.name,params:{requestId:review.id}}">{{ eligible(review) ? 'Review' : 'View request' }}</router-link></td>
        </tr></tbody></table></div>
      </template>
    </section>
    <section v-if="!requestedId" class="review-metrics" aria-label="Review queue summary">
      <div v-for="metric in metrics" :key="metric.label" class="review-card metric"><small>{{ metric.label }}</small><strong>{{ loading && !reviews.length || error && !reviews.length ? '—' : metric.value }}</strong></div>
    </section>
    <details v-if="!requestedId" class="review-policy">
      <summary>How approvals work</summary>
      <p>An authorized checker reviews each request independently. Decisions are recorded in the audit history.</p>
    </details>
    <p v-if="requestedId && loading" role="status">Loading request…</p>
    <p v-if="requestedId && !loading && !error && !selected" role="status">This request is unavailable. <router-link :to="{name:$route.name}">Back to approvals</router-link></p>
    <section v-if="selected" id="review-detail" class="review-card decision" aria-labelledby="review-title">
      <div class="section-title"><h2 id="review-title">Request details <small>· {{ selected.id.slice(0,8) }}</small></h2></div>
      <p v-if="selected.summary !== requestTitle">{{ selected.summary }}</p>
      <p v-if="selected.comment" class="decision-note"><strong>Checker comment</strong><br />{{ selected.comment }}</p>
      <router-link v-if="selected.proposed?.revisesRequestId" class="pmo-control quiet"
        :to="{ name:$route.name, params:{requestId:selected.proposed.revisesRequestId} }">View original request</router-link>
      <router-link v-if="revisionRoute" class="pmo-control primary" :to="revisionRoute">Revise and resubmit</router-link>
      <dl v-if="details.length" class="review-details">
        <template v-for="[label, value] in details" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></template>
      </dl>
      <PortfolioSnapshot v-if="selected.kind === 'REPORT_PUBLISH' && selected.proposed?.snapshot" :data="selected.proposed.snapshot" title="Frozen executive snapshot" />
      <p v-else-if="selected.kind === 'REPORT_PUBLISH'" role="alert">The submitted snapshot is unavailable.</p>
      <p v-if="selected.kind === 'REGISTRATION'" class="info">Registration details are redacted until account approval. Password hashes are never returned by this API.</p>
      <template v-if="canReview">
      <label for="review-comment">Decision comment</label>
      <textarea id="review-comment" v-model.trim="comment" rows="3" maxlength="1000" placeholder="Reason for rejection / return or review notes"></textarea>
      <div class="review-actions">
        <button class="pmo-control primary" :disabled="!canReview || busy" @click="decide('APPROVED')">Approve</button>
        <button :disabled="!canReview || busy" class="pmo-control" @click="decide('RETURNED')">Return to maker</button>
        <button :disabled="!canReview || busy" class="pmo-control danger" @click="decide('REJECTED')">Reject</button>
      </div>
      </template>
      <p v-if="selected.makerId && selected.makerId === currentUserId" class="feedback error">You submitted this change; another authorized checker must review it.</p>
    </section>
  </main>
</template>

<script setup>
import PortfolioSnapshot from '../../../components/PortfolioSnapshot.vue';
import SmartSelect from '../../../components/SmartSelect.vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from '../../../api/axiosConfig';
const props=defineProps({ module:{type:String,required:true} });
const kindGroups={
  projects:['PROJECT_CREATE','PROJECT_UPDATE','TASK_CREATE','TASK_UPDATE'],
  raid:['RISK_CREATE','RISK_UPDATE','ISSUE_CREATE','ISSUE_UPDATE','DECISION_CREATE','ACTION_CREATE','ACTION_UPDATE'],
  timesheets:['TIMESHEET_CREATE'],reports:['REPORT_PUBLISH'],leave:['LEAVE_REQUEST'],
  admin:['REGISTRATION','PARAMETER_UPDATE','MEMBERSHIP_UPDATE']
};
const moduleLabel=computed(()=>({projects:'Project',raid:'RAID',timesheets:'Timesheet',reports:'Report',leave:'Leave',admin:'Administration'})[props.module]||'Module');
const labelKind=kind=>String(kind||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const reviews = ref([]), loading = ref(true), busy = ref(false), error = ref(''), notice = ref('');
const comment = ref(''), filter = ref('ALL'), scope = ref('ALL');
const route = useRoute();
const routeHeading = ref(null);
const requestedId = computed(() => route.params.requestId);
const selected = computed(() => reviews.value.find(r => r.id === requestedId.value));
const requestTitle = computed(() => selected.value?.kind === 'REPORT_PUBLISH' ? 'Executive snapshot request' :
  ['PROJECT_CREATE', 'PROJECT_UPDATE'].includes(selected.value?.kind) && selected.value.proposed?.values?.name ? selected.value.proposed.values.name + ' · Project request' :
  selected.value?.summary || 'Approval request');
const details = computed(() => {
  const proposed = selected.value?.proposed;
  if (!proposed) return [];
  const values = proposed.values || Object.fromEntries(Object.entries(proposed)
    .filter(([key]) => !['snapshot', 'targetId', 'projectId', 'previousUpdatedAt', 'revisesRequestId'].includes(key)));
  const labels = { name: 'Project name', client: 'Client / business unit', startDate: 'Planned start', targetEndDate: 'Target completion', description: 'Overview and outcome', deliveryMethod: 'Delivery method' };
  return Object.entries(values).filter(([, value]) =>
    value !== null && value !== '' && ['string', 'number', 'boolean'].includes(typeof value)
  ).map(([key, value]) => [
    labels[key] || labelKind(key.replace(/([a-z])([A-Z])/g, '$1 $2')),
    key === 'deliveryMethod' ? ({ KANBAN: 'Agile · Kanban', WATERFALL: 'Waterfall · Phases' })[value] || value :
      /date$/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(value) ? String(value).slice(0, 10) : String(value)
  ]);
});
watch(() => selected.value?.id, async id => {
  comment.value = '';
  if (id) {
    await nextTick();
    routeHeading.value?.focus();
  }
});
const filtered = computed(() => reviews.value.filter(review =>
  (filter.value === 'ALL' || review.status === filter.value)
  && (scope.value === 'ALL' || (scope.value === 'MINE' ? review.makerId === currentUserId.value : eligible(review)))
));
const scopedReviews = computed(() => reviews.value.filter(review => scope.value === 'ALL' || (scope.value === 'MINE' ? review.makerId === currentUserId.value : eligible(review))));
const metrics = computed(() => [
  { label: 'Pending review', value: scopedReviews.value.filter(r => r.status === 'PENDING').length },
  { label: 'Returned', value: scopedReviews.value.filter(r => r.status === 'RETURNED').length },
  { label: 'Approved', value: scopedReviews.value.filter(r => r.status === 'APPROVED').length },
  { label: 'Rejected', value: scopedReviews.value.filter(r => r.status === 'REJECTED').length }
]);
const currentUser = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
});
const currentUserId = computed(() => currentUser.value.id);
const revisionRoute = computed(() => {
  const request = selected.value;
  if (!request || request.status !== 'RETURNED' || request.makerId !== currentUserId.value) return null;
  const name = { PROJECT_CREATE: 'ProjectCreate', LEAVE_REQUEST: 'Leave' }[request.kind];
  return name ? { name, query: { revise: request.id } } : null;
});
function eligible(review) {
  const role = currentUser.value.role;
  return review?.status === 'PENDING' && Boolean(currentUserId.value) && review.makerId !== currentUserId.value
    && ['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(role)
    && (props.module !== 'admin' || role === 'ADMIN')
    && (review.kind !== 'REPORT_PUBLISH' || (role !== 'PROJECT_MANAGER' && Boolean(review.proposed?.snapshot)));
}
const canReview = computed(() => eligible(selected.value));
const initials = value => value ? String(value).trim().split(/\\s+/).slice(0,2).map(s => s[0].toUpperCase()).join('') : 'RQ';
function describe(e) { const m=e.response?.data?.message; return Array.isArray(m)?m.join(', '):m||e.message||'Request failed'; }
let loadSequence = 0;
async function load() {
  error.value = ''; loading.value = true;
  const sequence = ++loadSequence;
  try {
    const { data } = await axios.get('/reviews', {params:{module:props.module,id:requestedId.value}});
    if (sequence === loadSequence) reviews.value = data.data.filter(r => (kindGroups[props.module] || []).includes(r.kind));
  } catch (e) {
    if (sequence === loadSequence) error.value = describe(e);
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}
async function decide(decision) {
  if (!canReview.value) return;
  if (decision !== 'APPROVED' && !comment.value) { error.value = 'A comment is required for rejection or return.'; return; }
  busy.value = true; error.value = '';
  try {
    await axios.post('/reviews/' + selected.value.id + '/decision', { decision, comment: comment.value });
    notice.value = 'Review marked ' + decision.toLowerCase() + '.';
    comment.value = ''; await load();
  } catch(e) { error.value = describe(e); }
  finally { busy.value = false; }
}
onMounted(load);
watch([() => props.module, requestedId], () => { reviews.value = []; notice.value = ''; load(); });
</script>
<style scoped>
.decision-note{overflow-wrap:anywhere;white-space:pre-wrap}
.review-page{grid-template-columns:minmax(0,1fr)}
.review-card,.table-wrap{min-inline-size:0}
.table-wrap{max-inline-size:100%}
.review-details{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px 16px}
.review-details dt{font-weight:600}
.review-details dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
.review-card .text-button{display:inline-flex;align-items:center;min-height:44px}
@media(max-width:520px){.queue .section-title{align-items:flex-start;flex-wrap:wrap}.review-details{grid-template-columns:minmax(0,1fr)}}
.person{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.review-page{background:var(--pmo-accent-soft);min-height:calc(100vh - 60px);padding:32px;display:grid;gap:22px;align-content:start;color:var(--pmo-text)}.review-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.review-heading h1{font-size:30px;margin:6px 0}.review-heading p:not(.eyebrow){color:#64748b}.eyebrow{font-size:11px;letter-spacing:.08em;font-weight:800;color:var(--pmo-accent-ink)}.review-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.review-card{background:#fff;border:1px solid var(--pmo-border);padding:24px;border-radius:16px}.metric{display:grid;gap:10px}.metric small{color:#64748b}.metric strong{font-size:30px}.rules{background:var(--pmo-accent-soft)}.rules h2{color:var(--pmo-accent-ink)}.rules p,.info{color:#66758b;font-size:13px}.review-card h2{font-size:18px;margin:0 0 12px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left}th{background:var(--pmo-accent-soft);font-size:11px;color:#65748b;padding:14px}td{border-bottom:1px solid var(--pmo-border);font-size:12px;padding:14px;white-space:nowrap}.mono{font-family:monospace}.avatar{display:inline-grid;place-items:center;border-radius:50%;height:29px;width:29px;margin-right:8px;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);font-size:10px;font-weight:800}.status{font-size:10px;font-weight:800;padding:7px 10px;border-radius:20px;background:var(--pmo-accent-soft);color:#56677e}.status.pending{background:#fff1d7;color:#99661a}.status.approved{background:#e0f6ed;color:#197957}.status.rejected{background:#ffe8ed;color:#a63450}.status.returned{background:#fef2dc;color:#99661a}select,textarea{border:1px solid var(--pmo-border);border-radius:9px;padding:10px;background:var(--pmo-accent-soft);color:var(--pmo-text);font:inherit}.decision label{display:block;font-size:12px;font-weight:700;margin:16px 0 8px}.decision textarea{display:block;width:100%}.review-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}button{cursor:pointer;border:0;border-radius:10px;background:var(--pmo-accent);color:var(--pmo-on-accent);font-weight:700;padding:11px 15px}button:disabled{opacity:.5;cursor:not-allowed}button.secondary{background:var(--pmo-accent-soft);color:var(--pmo-accent-ink)}button.danger{background:#ffe5eb;color:#a7314e}.text-button{background:none;color:var(--pmo-accent-ink);padding:6px}.feedback{background:#e6f7ed;color:#157a57;padding:12px;border-radius:9px}.feedback.error{background:#ffe9ed;color:#a02a47}.diff pre{white-space:pre-wrap;background:var(--pmo-accent-soft);border-radius:9px;padding:15px;font-size:12px}.empty{color:#64748b;padding:25px 0}
@media(max-width:900px){.review-metrics{grid-template-columns:repeat(2,1fr)}.review-page{padding:20px}}@media(max-width:520px){.review-metrics{grid-template-columns:1fr 1fr}.review-heading{align-items:flex-start;flex-direction:column}}
</style>
