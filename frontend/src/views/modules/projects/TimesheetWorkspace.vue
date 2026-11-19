<template>
  <main class="timesheets">
    <header class="work-header">
      <div><h1>Timesheets</h1><p>Log work against a project and track approved hours by week.</p></div>
      <button v-if="projectId" type="button" class="pmo-control primary" @click="composeOpen=true">
        <span class="material-symbols-outlined" aria-hidden="true">add</span>Log time
      </button>
    </header>
    <p v-if="!liveMode" class="notice" role="status">Sign in to a connected workspace to log time.</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="message" class="notice success" role="status">{{ message }}</p>
    <p v-if="loading" role="status">Loading time entries…</p>
    <section v-if="liveMode && !loading && !error && !projects.length" class="work-empty">
      <span class="record-icon material-symbols-outlined" aria-hidden="true">schedule</span>
      <div><h2>No active project yet</h2><p>Once a project is approved, you can log time and see approved entries here.</p></div>
      <router-link class="pmo-control primary" to="/projects">View projects and requests</router-link>
    </section>
    <PremiumComposeDialog :open="composeOpen" title="New time entry" eyebrow="RESOURCE / TIMESHEETS" description="Choose a project, enter your hours, and send the entry for review." :error="error" @close="composeOpen=false">
      <form id="time-entry-form" class="entry-form" @submit.prevent="submit">
        <div class="field full"><label for="timesheet-project">Project</label>
          <SmartSelect id="timesheet-project" v-model="projectId" aria-label="Project" :disabled="!liveMode || busy" @change="loadEntries" :options="[{value:'',label:'Select project'},...projects.map(project=>({value:project.id,label:project.name}))]" /></div>
        <div class="field"><label for="timesheet-date">Work date</label>
          <SmartDatePicker id="timesheet-date" v-model="workDate" aria-label="Work date" :max="today" required :disabled="!liveMode || busy" /></div>
        <div class="field"><label for="timesheet-hours">Hours worked</label>
          <input id="timesheet-hours" type="number" v-model.number="hours" min="0.25" max="24" step="0.25"
            required :disabled="!liveMode || busy"/></div>
        <div class="field full"><label for="timesheet-description">Work completed</label>
          <textarea id="timesheet-description" v-model.trim="description" rows="3" maxlength="1000"
            placeholder="Describe your work for the project" :disabled="!liveMode || busy"></textarea></div>
      </form>
      <template #footer>
        <button type="button" class="pmo-control" @click="composeOpen=false">Cancel</button>
        <button type="submit" form="time-entry-form" class="pmo-control primary" :disabled="busy || !projectId || !workDate">{{ busy ? 'Submitting…' : 'Submit for review' }}</button>
      </template>
    </PremiumComposeDialog>
    <section v-if="projects.length" class="work-panel" aria-labelledby="time-ledger">
      <header class="work-toolbar">
        <div><h2 id="time-ledger">Approved time</h2><p aria-live="polite">{{ weekLabel }} · {{ weeklyHours.toFixed(2) }} hours</p></div>
        <div class="work-actions">
          <button type="button" class="pmo-control quiet" aria-label="Previous week" @click="weekOffset--">‹</button>
          <button type="button" class="pmo-control quiet" @click="weekOffset=0">This week</button>
          <button type="button" class="pmo-control quiet" aria-label="Next week" :disabled="weekOffset >= 0" @click="weekOffset++">›</button>
        </div>
      </header>
      <div class="work-toolbar work-filters">
        <label>Project
          <SmartSelect v-model="projectId" aria-label="Timesheet project" @change="loadEntries" :options="projects.map(project=>({value:project.id,label:project.name}))" />
        </label>
        <router-link v-if="projectId" class="pmo-control quiet" :to="{path:'/timesheets/detail',query:{projectId}}">Full history</router-link>
      </div>
      <div v-if="weeklyEntries.length" class="table-scroll" tabindex="0" role="region" aria-label="Approved time entries this week">
        <table><thead><tr><th scope="col">Date</th><th scope="col">Work</th><th scope="col">Hours</th></tr></thead>
          <tbody><tr v-for="entry in weeklyEntries" :key="entry.id"><td>{{ formatDate(entry.workDate) }}</td><td>{{ entry.description || 'No description' }}</td><td class="hours">{{ Number(entry.hours).toFixed(2) }}</td></tr></tbody>
        </table>
      </div>
      <p v-else-if="!loading && !error" class="work-panel-empty">No approved time for this week. Entries appear after independent review.</p>
    </section>
  </main>
</template>
<script setup>
import SmartDatePicker from "../../../components/SmartDatePicker.vue";
import { useRoute } from 'vue-router';
import SmartSelect from '../../../components/SmartSelect.vue';
import PremiumComposeDialog from '../../../components/PremiumComposeDialog.vue';
import { computed, onMounted, ref } from 'vue';
import axiosInstance from '../../../api/axiosConfig';

const composeOpen = ref(false);
const route = useRoute();
const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const localToday = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0,10);
};
const today = localToday();
const workDate = ref(today), projectId = ref(''), hours = ref(8), description = ref('');
const projects = ref([]), entries = ref([]), loading = ref(false), busy = ref(false), error = ref(''), message = ref('');
const weekOffset = ref(0);
const week = computed(() => {
  const start = new Date(today + 'T12:00:00');
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 + weekOffset.value * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
});
const weekLabel = computed(() => {
  const last = new Date(week.value.end);
  last.setDate(last.getDate() - 1);
  return formatDate(week.value.start) + ' – ' + formatDate(last);
});
const localWorkDate = value => typeof value === 'string' && value.length === 10 ? new Date(value + 'T12:00:00') : new Date(value);
const weeklyEntries = computed(() => entries.value.filter(entry => {
  const date = localWorkDate(entry.workDate);
  date.setHours(12, 0, 0, 0);
  return date >= week.value.start && date < week.value.end;
}));
const weeklyHours = computed(() => weeklyEntries.value.reduce((sum, entry) => sum + Number(entry.hours || 0), 0));
const formatDate = value => localWorkDate(value).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
function reportError(cause) {
  const message = cause.response?.data?.message;
  error.value = Array.isArray(message) ? message.join(', ') : message || cause.message || 'Operation failed';
}
async function loadProjects() {
  if (!liveMode) return;
  loading.value = true;
  try {
    const res = await axiosInstance.get('/projects');
    projects.value = res.data.data;
    projectId.value = projects.value.find(project => project.id === route.query.projectId)?.id || projects.value[0]?.id || '';
    await loadEntries();
  } catch (cause) { reportError(cause); } finally { loading.value = false; }
}
async function loadEntries() {
  entries.value = [];
  if (!projectId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await axiosInstance.get('/projects/' + encodeURIComponent(projectId.value) + '/timesheets');
    entries.value = res.data.data;
  } catch (cause) { reportError(cause); } finally { loading.value = false; }
}
async function submit() {
  if (busy.value || !projectId.value || !workDate.value) return;
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    await axiosInstance.post('/reviews/operations', {
      kind: 'TIMESHEET_CREATE', projectId: projectId.value,
      summary: 'Log ' + Number(hours.value) + ' hours for ' + workDate.value,
      values: { workDate: new Date(workDate.value + 'T12:00:00').toISOString(),
        hours: Number(hours.value), description: description.value }
    });
    description.value = '';composeOpen.value=false;
    message.value = 'Timesheet submitted for independent approval.';
  } catch (cause) { reportError(cause); } finally { busy.value = false; }
}
onMounted(loadProjects);
</script>
<style scoped>
.module-shortcuts{display:flex;gap:12px;flex-wrap:wrap}
.timesheets{padding:34px;background:var(--pmo-accent-soft);min-height:100vh;color:var(--pmo-text)}
.page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
.eyebrow{font-size:11px;color:var(--pmo-accent-ink);font-weight:800;letter-spacing:.1em}
.page-heading h1{font-size:29px;font-weight:750;margin:6px 0}
.page-heading p:not(.eyebrow){color:#6d7c91;font-size:14px}
.page-heading a{padding:12px 18px;color:var(--pmo-accent-ink);background:white;border-radius:10px;white-space:nowrap;font-size:13px;font-weight:700}
.panel{background:white;padding:27px;border:1px solid var(--pmo-border);border-radius:18px;margin:0 0 22px}
.entry-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.field{display:flex;flex-direction:column;gap:9px}
.full{grid-column:1/-1}
.field label{font-size:12px;font-weight:700;color:#536781}
input,select,textarea{padding:12px;border:1px solid var(--pmo-border);border-radius:10px;font:inherit;font-size:14px;background:#fff;color:var(--pmo-text)}
button{background:var(--pmo-accent);color:var(--pmo-on-accent);border:0;border-radius:10px;padding:12px 19px;font-weight:700;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
.form-bottom{flex-direction:row;align-items:center}.form-bottom span{font-size:12px;color:#7b89a0}
.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.section-title h2{font-size:20px;font-weight:750}.section-title span{font-size:13px;color:#5f7289}
.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:520px}
th{background:var(--pmo-accent-soft);text-align:left;color:#61748c;font-size:11px;text-transform:uppercase;padding:14px}
td{border-bottom:1px solid var(--pmo-border);padding:17px 14px;font-size:14px}
.hours{font-weight:700;color:var(--pmo-accent-ink)}.empty{text-align:center;padding:35px;color:#718198}
.notice{padding:15px 19px;border-radius:10px;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);margin-bottom:20px}
.notice.error{background:#ffeaed;color:#b3374d}.notice.success{background:#e5f8ee;color:#14724b}
@media(max-width:680px){.timesheets{padding:16px}.page-heading{flex-direction:column;align-items:start}.panel{padding:18px}.entry-form{grid-template-columns:1fr}.form-bottom{flex-direction:column;align-items:start}}
@media(max-width:600px){
  .work-panel table{min-width:0;table-layout:fixed}
  .work-panel :is(th,td){padding:9px 6px;overflow-wrap:anywhere}
  .work-panel th:first-child{width:26%}
  .work-panel th:last-child{width:22%}
}
</style>
