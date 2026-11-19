<template>
  <main class="history-page leave-ledger">
    <header class="ledger-heading">
      <div>
        <h1>Leave records &amp; policies</h1>
        <p>Track your requests, decisions, and available leave.</p>
      </div>
      <router-link class="pmo-control primary" :to="{ name: 'Leave', query: { request: '1' } }">
        <span class="material-symbols-outlined" aria-hidden="true">add</span>Request leave
      </router-link>
    </header>

    <section v-if="balances" class="ledger-balance" aria-labelledby="leave-balance-title">
      <div class="balance-feature">
        <div class="balance-label">
          <span class="material-symbols-outlined" aria-hidden="true">calendar_today</span>
          <h2 id="leave-balance-title">Annual leave remaining</h2>
        </div>
        <p class="balance-value">{{ balances.remaining.ANNUAL }} <span>days</span></p>
        <p v-if="balances.entitlement?.ANNUAL != null" class="balance-detail">{{ balances.used?.ANNUAL ?? '—' }} used of {{ balances.entitlement.ANNUAL }} days</p>
      </div>
      <div class="balance-secondary">
        <h2>Medical leave remaining</h2>
        <p class="balance-value">{{ balances.remaining.MEDICAL }} <span>days</span></p>
      </div>
    </section>
    <p v-if="balanceError" class="ledger-alert" role="alert">{{ balanceError }}</p>

    <section class="ledger-panel" aria-labelledby="leave-history-title">
      <header class="ledger-panel-heading">
        <div>
          <h2 id="leave-history-title">Request history <span v-if="records.length" class="pmo-status">{{ records.length }}</span></h2>
          <p>Pending requests affect your balance after approval.</p>
        </div>
        <div class="ledger-actions">
          <button type="button" class="pmo-control refresh-ledger" :disabled="loading" @click="load">
            <span class="material-symbols-outlined" aria-hidden="true">refresh</span>{{ loading ? 'Refreshing…' : 'Refresh' }}
          </button>
          <button v-if="visible.length" type="button" class="pmo-control" @click="exportCSV">
            <span class="material-symbols-outlined" aria-hidden="true">download</span>Export CSV
          </button>
        </div>
      </header>

      <p v-if="loading" class="ledger-feedback" role="status">{{ loaded ? 'Refreshing requests…' : 'Loading your requests…' }}</p>
      <p v-if="recordsError" class="ledger-feedback ledger-alert" role="alert">{{ recordsError }}{{ loaded ? ' Showing your last available requests.' : ' Use Refresh to try again.' }}</p>

      <div v-if="records.length" class="ledger-filters" aria-label="Filter requests">
        <label>Leave type
          <SmartSelect v-model="typeFilter" aria-label="Leave type filter" :options="types" />
        </label>
        <label>Status
          <SmartSelect v-model="statusFilter" aria-label="Leave status filter" :options="statuses" />
        </label>
        <button v-if="filtered" type="button" class="pmo-control" @click="clearFilters">Clear filters</button>
        <span class="ledger-count" role="status">{{ visible.length }} of {{ records.length }} requests</span>
      </div>

      <div v-if="visible.length" class="ledger-scroll" tabindex="0" role="region" aria-label="Leave request history table">
        <table>
          <thead><tr><th scope="col">Leave type</th><th scope="col">Dates</th><th scope="col">Duration</th><th scope="col">Status</th><th scope="col">Submitted</th></tr></thead>
          <tbody>
            <tr v-for="record in visible" :key="record.id">
              <th scope="row"><strong>{{ label(record.type) }} leave</strong><small>Ref {{ record.id.slice(0, 8) }}</small></th>
              <td>{{ dateRange(record.startDate, record.endDate) }}</td>
              <td>{{ duration(record.dayType) }}</td>
              <td><span class="record-state" :data-state="record.status">{{ label(record.status) }}</span></td>
              <td>{{ formatDate(record.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="loaded && !loading && !recordsError" class="ledger-empty">
        <span class="material-symbols-outlined record-icon" aria-hidden="true">{{ filtered ? 'filter_list_off' : 'event_note' }}</span>
        <div>
          <h3>{{ filtered ? 'No requests match these filters' : 'No leave requests yet' }}</h3>
          <p>{{ filtered ? 'Change the filters to see more requests.' : 'Your requests and their approval status will appear here.' }}</p>
        </div>
      </div>
    </section>

    <aside class="ledger-policy" aria-labelledby="leave-policy-title">
      <span class="material-symbols-outlined record-icon" aria-hidden="true">policy</span>
      <div>
        <h2 id="leave-policy-title">Organization policy</h2>
        <p>{{ balances?.note || 'Leave entitlements and holidays follow your organization’s policy.' }}</p>
        <router-link v-if="isAdmin" class="policy-link" to="/admin/parameters">Manage leave policy</router-link>
      </div>
    </aside>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import SmartSelect from '../../../components/SmartSelect.vue';
import axios from '../../../api/axiosConfig';

const records = ref([]);
const balances = ref(null);
const loaded = ref(false);
const loading = ref(false);
const recordsError = ref('');
const balanceError = ref('');
const typeFilter = ref('');
const statusFilter = ref('');
const role = (() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role; }
  catch { return null; }
})();
const isAdmin = role === 'ADMIN';
const label = value => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/^./, char => char.toUpperCase());
const types = [{ value: '', label: 'All types' }, ...['ANNUAL', 'MEDICAL', 'EMERGENCY', 'UNPAID'].map(value => ({ value, label: label(value) }))];
const statuses = [{ value: '', label: 'All statuses' }, ...['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'].map(value => ({ value, label: label(value) }))];
const filtered = computed(() => Boolean(typeFilter.value || statusFilter.value));
const visible = computed(() => records.value.filter(record =>
  (!typeFilter.value || record.type === typeFilter.value) && (!statusFilter.value || record.status === statusFilter.value)));
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDate = value => value ? dateFormat.format(new Date(value)) : '—';
const dateRange = (start, end) => start === end ? formatDate(start) : formatDate(start) + ' – ' + formatDate(end);
const duration = type => ({ AM: 'Morning half-day', PM: 'Afternoon half-day' })[type] || 'Full day';

function clearFilters() {
  typeFilter.value = '';
  statusFilter.value = '';
}
async function load() {
  if (loading.value) return;
  loading.value = true;
  recordsError.value = '';
  balanceError.value = '';
  const [leave, balance] = await Promise.allSettled([axios.get('/leave/mine'), axios.get('/leave/balances')]);
  if (leave.status === 'fulfilled') {
    records.value = leave.value.data.data;
    loaded.value = true;
  } else recordsError.value = 'Could not load your leave requests.';
  if (balance.status === 'fulfilled') balances.value = balance.value.data.data;
  else balanceError.value = 'Could not refresh your leave balances.';
  loading.value = false;
}
function exportCSV() {
  if (!visible.value.length) return;
  const headers = ['Request ID', 'Type', 'Start', 'End', 'Day Type', 'Status', 'Submitted'];
  const rows = visible.value.map(record => [record.id, record.type, record.startDate, record.endDate, record.dayType, record.status, record.createdAt]);
  const safe = value => {
    const text = String(value ?? '');
    return '"' + (/^[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  };
  const csv = [headers, ...rows].map(row => row.map(safe).join(',')).join('\r\n');
  const href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'pmo-personal-leave-' + new Date().toISOString().slice(0, 10) + '.csv';
  anchor.click();
  URL.revokeObjectURL(href);
}
onMounted(load);
</script>

<style scoped>
.leave-ledger{min-height:calc(100dvh - 100px);display:grid;align-content:start;gap:20px;padding:28px var(--product-gutter);color:var(--pmo-text)}
.ledger-heading,.ledger-panel-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}
.leave-ledger .ledger-heading{margin:0}
.ledger-heading h1,.ledger-panel-heading h2,.ledger-policy h2{margin:0}
.ledger-heading p,.ledger-panel-heading p,.ledger-empty p,.ledger-policy p{margin:4px 0 0;color:var(--pmo-muted)}
.ledger-heading .pmo-control,.ledger-actions .pmo-control{gap:6px;white-space:nowrap}
.pmo-control .material-symbols-outlined{font-size:18px}
.ledger-balance{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px}
.balance-feature,.balance-secondary{padding:16px 20px;border:1px solid var(--pmo-border);border-radius:12px;background:var(--pmo-panel)}
.balance-feature{background:var(--pmo-accent-soft)}
.balance-label{display:flex;align-items:center;gap:8px}
.balance-label .material-symbols-outlined{font-size:18px;color:var(--pmo-accent)}
.leave-ledger .ledger-balance h2{font-size:14px;line-height:20px;letter-spacing:0;margin:0}
.leave-ledger .balance-value{font-size:30px;line-height:34px;font-weight:720;letter-spacing:-.035em;font-variant-numeric:tabular-nums;color:var(--pmo-text);margin:6px 0 0}
.balance-value span{font-size:13px;font-weight:500;letter-spacing:0;color:var(--pmo-muted)}
.balance-detail{margin:4px 0 0;font-size:12px}
.ledger-panel{min-width:0;background:var(--pmo-panel);border:1px solid var(--pmo-border);border-radius:12px}
.ledger-panel-heading{padding:18px 20px}
.ledger-panel-heading h2{display:flex;align-items:center;gap:8px}
.ledger-actions,.ledger-filters{display:flex;align-items:end;flex-wrap:wrap;gap:8px 12px}
.ledger-actions .refresh-ledger{background:transparent}
.ledger-filters{padding:12px 20px;background:var(--pmo-surface-alt);border-block:1px solid var(--pmo-border)}
.ledger-filters label{display:grid;gap:4px;font-size:12px;font-weight:650}
.ledger-count{margin-inline-start:auto;align-self:center;font-size:12px;color:var(--pmo-muted)}
.ledger-scroll{max-inline-size:100%;overflow:auto}
.ledger-scroll table{border-collapse:collapse;text-align:start;width:100%;min-width:600px;font-size:13px}
.ledger-scroll :is(th,td){text-align:start;padding:13px 20px;border-bottom:1px solid var(--pmo-border)}
.ledger-scroll tbody th{background:transparent}
.ledger-scroll :is(strong,small){display:block}
.ledger-scroll small{margin-top:3px;color:var(--pmo-muted)}
.ledger-scroll .record-state[data-state=APPROVED]{background:#e2f3eb;color:#145844;border-color:#bcdfd0}
.ledger-scroll .record-state[data-state=RETURNED]{background:#fff3da;color:#72500d;border-color:#ebd7aa}
.ledger-scroll .record-state[data-state=REJECTED]{background:#fde9ed;color:#81283d;border-color:#f1c6cf}
.ledger-empty{display:flex;align-items:center;gap:12px;padding:18px 20px;border-top:1px solid var(--pmo-border)}
.ledger-empty h3{font-size:15px;margin:0}
.ledger-feedback{padding:0 20px}
.ledger-alert{color:var(--pmo-danger)}
.ledger-policy{display:flex;align-items:flex-start;gap:12px;padding:14px 4px}
.leave-ledger .ledger-policy h2{font-size:16px;line-height:22px}
.ledger-policy .policy-link{display:inline-flex;align-items:center;min-height:44px;font-size:13px;font-weight:650}
@media(max-width:600px){
  .leave-ledger{padding-block:20px;gap:16px}
  .balance-feature,.balance-secondary{padding:12px}
  .ledger-panel-heading,.ledger-empty,.ledger-filters{padding-inline:14px}
  .ledger-policy{padding-inline:2px}
}
</style>
