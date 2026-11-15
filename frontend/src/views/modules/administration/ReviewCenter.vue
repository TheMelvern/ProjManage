<template>
  <main class="review-page">
    <header class="review-heading">
      <div><p class="eyebrow">GOVERNANCE / FOUR-EYES CONTROL</p><h1>Approval Center</h1>
        <p>Independent review for project changes and account onboarding.</p></div>
      <button class="secondary" @click="load">Refresh queue</button>
    </header>
    <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
    <p v-if="notice" class="feedback" role="status">{{ notice }}</p>
    <section class="review-metrics" aria-label="Review queue summary">
      <div v-for="metric in metrics" :key="metric.label" class="review-card metric"><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong></div>
    </section>
    <section class="review-card rules">
      <h2>Mandatory separation of duties</h2>
      <p>No self-approval · Authorized organization checker · Decisions recorded in audit history · Approved project changes become effective only after review.</p>
    </section>
    <section class="review-card queue">
      <div class="section-title"><h2>Approval work queue</h2><label>Filter status
        <select v-model="filter"><option value="ALL">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="RETURNED">Returned</option></select>
      </label></div>
      <div v-if="loading">Loading review requests…</div>
      <div v-else-if="!filtered.length" class="empty">No review requests match this filter.</div>
      <div v-else class="table-wrap"><table><thead><tr><th>Reference</th><th>Module</th><th>Maker</th><th>Summary</th><th>Status</th><th>Checker</th><th>Action</th></tr></thead>
        <tbody><tr v-for="review in filtered" :key="review.id">
          <td class="mono">{{ review.id.slice(0,8) }}</td>
          <td>{{ review.kind === 'REGISTRATION' ? 'Account registration' : 'Project delivery' }}</td>
          <td><span class="avatar">{{ initials(review.makerId) }}</span>{{ review.makerId ? review.makerId.slice(0,8) : 'Applicant' }}</td>
          <td>{{ review.summary }}</td>
          <td><span class="status" :class="review.status.toLowerCase()">{{ review.status }}</span></td>
          <td>{{ review.checkerId ? review.checkerId.slice(0,8) : '—' }}</td>
          <td><button class="text-button" @click="selectedId = review.id">Review</button></td>
        </tr></tbody></table></div>
    </section>
    <section v-if="selected" class="review-card decision">
      <div class="section-title"><h2>Review decision · {{ selected.id.slice(0,8) }}</h2><span class="status" :class="selected.status.toLowerCase()">{{ selected.status }}</span></div>
      <p>Proposed change: {{ selected.summary }}</p>
      <div v-if="selected.proposed" class="diff"><pre>{{ JSON.stringify(selected.proposed, null, 2) }}</pre></div>
      <p v-if="selected.kind === 'REGISTRATION'" class="info">Registration details are redacted until account approval. Password hashes are never returned by this API.</p>
      <label for="review-comment">Decision comment</label>
      <textarea id="review-comment" v-model.trim="comment" rows="3" maxlength="1000" placeholder="Reason for rejection / return or review notes"></textarea>
      <p v-if="selected.makerId && selected.makerId === currentUserId" class="feedback error">You submitted this change; another authorized checker must review it.</p>
      <div class="review-actions">
        <button :disabled="!canReview || busy" @click="decide('APPROVED')">Approve</button>
        <button :disabled="!canReview || busy" class="secondary" @click="decide('RETURNED')">Return to maker</button>
        <button :disabled="!canReview || busy" class="danger" @click="decide('REJECTED')">Reject</button>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import axios from '../../api/axiosConfig';
const reviews = ref([]), loading = ref(false), busy = ref(false), error = ref(''), notice = ref('');
const selectedId = ref(''), comment = ref(''), filter = ref('ALL');
const selected = computed(() => reviews.value.find(r => r.id === selectedId.value));
const filtered = computed(() => filter.value === 'ALL' ? reviews.value : reviews.value.filter(r => r.status === filter.value));
const metrics = computed(() => [
  { label: 'Pending review', value: reviews.value.filter(r => r.status === 'PENDING').length },
  { label: 'Returned', value: reviews.value.filter(r => r.status === 'RETURNED').length },
  { label: 'Approved', value: reviews.value.filter(r => r.status === 'APPROVED').length },
  { label: 'Rejected', value: reviews.value.filter(r => r.status === 'REJECTED').length }
]);
const currentUserId = computed(() => { try { return JSON.parse(localStorage.getItem('user') || '{}').id; } catch { return null; } });
const canReview = computed(() => selected.value?.status === 'PENDING' && selected.value?.makerId !== currentUserId.value);
const initials = value => value ? value.slice(0,2).toUpperCase() : 'RQ';
function describe(e) { const m=e.response?.data?.message; return Array.isArray(m)?m.join(', '):m||e.message||'Request failed'; }
async function load() {
  error.value = ''; loading.value = true;
  try { reviews.value = (await axios.get('/reviews')).data.data; }
  catch(e) { error.value = describe(e); }
  finally { loading.value = false; }
}
async function decide(decision) {
  if (!canReview.value) return;
  if (decision !== 'APPROVED' && !comment.value) { error.value = 'A comment is required for rejection or return.'; return; }
  busy.value = true; error.value = '';
  try {
    await axios.post('/reviews/' + selectedId.value + '/decision', { decision, comment: comment.value });
    notice.value = 'Review marked ' + decision.toLowerCase() + '.';
    comment.value = ''; await load();
  } catch(e) { error.value = describe(e); }
  finally { busy.value = false; }
}
onMounted(load);
</script>
<style scoped>
.review-page{background:#f4f7fb;min-height:100vh;padding:32px;display:grid;gap:22px;align-content:start;color:#18253c}.review-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.review-heading h1{font-size:30px;margin:6px 0}.review-heading p:not(.eyebrow){color:#64748b}.eyebrow{font-size:11px;letter-spacing:.08em;font-weight:800;color:#315ac4}.review-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.review-card{background:#fff;border:1px solid #e5ebf4;padding:24px;border-radius:16px}.metric{display:grid;gap:10px}.metric small{color:#64748b}.metric strong{font-size:30px}.rules{background:#eef3fe}.rules h2{color:#315ac4}.rules p,.info{color:#66758b;font-size:13px}.review-card h2{font-size:18px;margin:0 0 12px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left}th{background:#f0f3f8;font-size:11px;color:#65748b;padding:14px}td{border-bottom:1px solid #eef1f6;font-size:12px;padding:14px;white-space:nowrap}.mono{font-family:monospace}.avatar{display:inline-grid;place-items:center;border-radius:50%;height:29px;width:29px;margin-right:8px;background:#e6edfd;color:#315ac4;font-size:10px;font-weight:800}.status{font-size:10px;font-weight:800;padding:7px 10px;border-radius:20px;background:#eef2f7;color:#56677e}.status.pending{background:#fff1d7;color:#99661a}.status.approved{background:#e0f6ed;color:#197957}.status.rejected{background:#ffe8ed;color:#a63450}.status.returned{background:#fef2dc;color:#99661a}select,textarea{border:1px solid #d8e1ec;border-radius:9px;padding:10px;background:#f7f9fc;color:#18253c;font:inherit}.decision label{display:block;font-size:12px;font-weight:700;margin:16px 0 8px}.decision textarea{display:block;width:100%}.review-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}button{cursor:pointer;border:0;border-radius:10px;background:#315ac4;color:#fff;font-weight:700;padding:11px 15px}button:disabled{opacity:.5;cursor:not-allowed}button.secondary{background:#edf2fb;color:#315ac4}button.danger{background:#ffe5eb;color:#a7314e}.text-button{background:none;color:#315ac4;padding:6px}.feedback{background:#e6f7ed;color:#157a57;padding:12px;border-radius:9px}.feedback.error{background:#ffe9ed;color:#a02a47}.diff pre{white-space:pre-wrap;background:#f6f8fc;border-radius:9px;padding:15px;font-size:12px}.empty{color:#64748b;padding:25px 0}
@media(max-width:900px){.review-metrics{grid-template-columns:repeat(2,1fr)}.review-page{padding:20px}}@media(max-width:520px){.review-metrics{grid-template-columns:1fr 1fr}.review-heading{align-items:flex-start;flex-direction:column}}
</style>
