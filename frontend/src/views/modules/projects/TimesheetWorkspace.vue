<template>
  <main class="timesheets">
    <header class="page-heading">
      <div><p class="eyebrow">RESOURCE MANAGEMENT</p><h1>Project timesheets</h1>
        <p>Log effort against projects and review your saved time entries.</p></div>
      <router-link to="/workspace">Delivery workspace</router-link>
    </header>
    <p v-if="!liveMode" class="notice" role="status">Enable VITE_USE_LIVE_API=true and sign in to log time.</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="message" class="notice success" role="status">{{ message }}</p>
    <section class="panel">
      <form class="entry-form" @submit.prevent="submit">
        <div class="field full"><label for="timesheet-project">Project</label>
          <select id="timesheet-project" v-model="projectId" required :disabled="!liveMode || busy"
            @change="loadEntries">
            <option value="">Select project</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select></div>
        <div class="field"><label for="timesheet-date">Work date</label>
          <input id="timesheet-date" type="date" v-model="workDate" :max="today" required :disabled="!liveMode || busy" /></div>
        <div class="field"><label for="timesheet-hours">Hours worked</label>
          <input id="timesheet-hours" type="number" v-model.number="hours" min="0.25" max="24" step="0.25"
            required :disabled="!liveMode || busy"/></div>
        <div class="field full"><label for="timesheet-description">Work completed</label>
          <textarea id="timesheet-description" v-model.trim="description" rows="3" maxlength="1000"
            placeholder="Describe your work for the project" :disabled="!liveMode || busy"></textarea></div>
        <div class="field full form-bottom"><button type="submit" :disabled="!liveMode || busy || !projectId">Submit for check</button>
          <span>Entries are associated with your authenticated account.</span></div>
      </form>
    </section>
    <section class="panel">
      <div class="section-title"><h2>Time entries</h2><span>{{ totalHours.toFixed(2) }} total hours</span></div>
      <p v-if="loading" class="empty" role="status">Loading time entries…</p>
      <div v-else class="table-scroll"><table>
        <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Hours</th></tr></thead>
        <tbody><tr v-for="entry in entries" :key="entry.id">
          <td>{{ formatDate(entry.workDate) }}</td><td>{{ entry.description || 'No description' }}</td>
          <td class="hours">{{ Number(entry.hours).toFixed(2) }}</td></tr>
        <tr v-if="entries.length === 0"><td colspan="3" class="empty">No saved timesheets for this project.</td></tr>
        </tbody></table></div>
    </section>
  </main>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import axiosInstance from '../../../api/axiosConfig';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const localToday = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0,10);
};
const today = localToday();
const workDate = ref(today), projectId = ref(''), hours = ref(8), description = ref('');
const projects = ref([]), entries = ref([]), loading = ref(false), busy = ref(false), error = ref(''), message = ref('');
const totalHours = computed(() => entries.value.reduce((sum, entry) => sum + Number(entry.hours || 0), 0));
const formatDate = value => new Date(value).toLocaleDateString();
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
    projectId.value = projects.value[0]?.id || '';
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
    description.value = '';
    message.value = 'Timesheet submitted for independent approval.';
  } catch (cause) { reportError(cause); } finally { busy.value = false; }
}
onMounted(loadProjects);
</script>
<style scoped>
.timesheets{padding:34px;background:#f4f7fb;min-height:100vh;color:#1c2a43}
.page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
.eyebrow{font-size:11px;color:#4865af;font-weight:800;letter-spacing:.1em}
.page-heading h1{font-size:29px;font-weight:750;margin:6px 0}
.page-heading p:not(.eyebrow){color:#6d7c91;font-size:14px}
.page-heading a{padding:12px 18px;color:#3159b7;background:white;border-radius:10px;white-space:nowrap;font-size:13px;font-weight:700}
.panel{background:white;padding:27px;border:1px solid #e5eaf3;border-radius:18px;margin:0 0 22px}
.entry-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.field{display:flex;flex-direction:column;gap:9px}
.full{grid-column:1/-1}
.field label{font-size:12px;font-weight:700;color:#536781}
input,select,textarea{padding:12px;border:1px solid #d7dfeb;border-radius:10px;font:inherit;font-size:14px;background:#fff;color:#23354c}
button{background:#315ac4;color:white;border:0;border-radius:10px;padding:12px 19px;font-weight:700;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
.form-bottom{flex-direction:row;align-items:center}.form-bottom span{font-size:12px;color:#7b89a0}
.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.section-title h2{font-size:20px;font-weight:750}.section-title span{font-size:13px;color:#5f7289}
.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:520px}
th{background:#f3f6fa;text-align:left;color:#61748c;font-size:11px;text-transform:uppercase;padding:14px}
td{border-bottom:1px solid #eef1f6;padding:17px 14px;font-size:14px}
.hours{font-weight:700;color:#3159b7}.empty{text-align:center;padding:35px;color:#718198}
.notice{padding:15px 19px;border-radius:10px;background:#eaf0ff;color:#325ba5;margin-bottom:20px}
.notice.error{background:#ffeaed;color:#b3374d}.notice.success{background:#e5f8ee;color:#14724b}
@media(max-width:680px){.timesheets{padding:16px}.page-heading{flex-direction:column;align-items:start}.panel{padding:18px}.entry-form{grid-template-columns:1fr}.form-bottom{flex-direction:column;align-items:start}}
</style>
