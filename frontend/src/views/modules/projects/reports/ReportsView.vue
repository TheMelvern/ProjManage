<template>
  <section class="executive-reports">
    <header class="report-heading">
      <div>
        <p class="report-eyebrow">PROJECT MANAGEMENT OFFICE</p>
        <h1>Executive status reports</h1>
        <p class="report-description">Portfolio health calculated from saved projects and task completion.</p>
      </div>
      <div class="report-actions">
        <router-link to="/reports/detail" class="report-detail-link">View details</router-link><button type="button" @click="loadReport" :disabled="loading">Refresh</button>
        <button type="button" class="primary" @click="submitPublication" :disabled="!report || publishing">Submit report for check</button>
        <button type="button" @click="downloadCSV" :disabled="!selectedPublication">Export approved CSV</button>
      </div>
    </header>

    <p v-if="!liveMode" class="report-notice" role="status">
      Live reporting is not enabled. Set VITE_USE_LIVE_API=true and sign in with your local API account.
    </p>
    <p v-else-if="loading" class="report-notice" role="status">Loading portfolio report…</p>
    <div v-else-if="error" class="report-notice report-error" role="alert">
      {{ error }}
      <button type="button" @click="loadReport">Try again</button>
    </div>

    <p v-if="publicationNotice" class="report-notice" role="status">{{ publicationNotice }}</p>
    <div class="report-notice">
      <label for="approved-report">Approved executive snapshots</label>
      <SmartSelect id="approved-report" v-model="publicationId" aria-label="Approved executive snapshots" :options="[{value:'',label:'Choose approved publication'},...published.map(item=>({value:item.id,label:item.summary+' · '+formatDate(item.reviewedAt)}))]" />
      <small>Export is available only for independently approved snapshots.</small>
    </div>
    <template v-if="report">
      <div class="report-metrics">
        <article v-for="metric in metrics" :key="metric.label" class="report-metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.note }}</small>
        </article>
      </div>
      <article class="report-table-card">
        <div class="report-table-heading">
          <h2>Project portfolio</h2>
          <p>Generated {{ formatDate(report.generatedAt) }}</p>
        </div>
        <div class="report-scroll">
          <table>
            <thead><tr>
              <th scope="col">Project</th><th scope="col">Status</th>
              <th scope="col">Health</th><th scope="col">Progress</th>
              <th scope="col">Overdue tasks</th>
            </tr></thead>
            <tbody>
              <tr v-for="project in report.projects" :key="project.id">
                <td><strong>{{ project.name }}</strong><small>{{ project.client || 'No client specified' }}</small></td>
                <td>{{ formatLabel(project.status) }}</td>
                <td><span class="health" :class="'health-' + project.health.toLowerCase()">{{ formatLabel(project.health) }}</span></td>
                <td>{{ project.progressPercent }}%</td>
                <td>{{ project.overdueTasks }}</td>
              </tr>
              <tr v-if="report.projects.length === 0"><td colspan="5" class="empty">
                No projects yet. Create a project to begin tracking portfolio status.
              </td></tr>
            </tbody>
          </table>
        </div>
      </article>
    </template>
  </section>
</template>

<script setup>
import SmartSelect from '../../../../components/SmartSelect.vue';
import { computed, onMounted, ref } from 'vue';
import axiosInstance from '../../../../api/axiosConfig';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const loading = ref(false);
const error = ref('');
const report = ref(null);
const published = ref([]);
const publicationId = ref('');
const publishing = ref(false);
const publicationNotice = ref('');
const selectedPublication = computed(() => published.value.find(p => p.id === publicationId.value) || null);

const metrics = computed(() => {
  if (!report.value) return [];
  const summary = report.value.summary;
  return [
    { label: 'Total projects', value: summary.totalProjects, note: 'In this organization' },
    { label: 'Active projects', value: summary.activeProjects, note: 'Currently underway' },
    { label: 'At risk', value: summary.atRiskProjects, note: 'Amber or red health' },
    { label: 'Overdue tasks', value: summary.overdueTasks, note: 'Not completed by due date' }
  ];
});

const formatLabel = (value) => String(value || 'Unknown').toLowerCase().replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => new Date(value).toLocaleString();

async function loadReport() {
  if (!liveMode) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await axiosInstance.get('/reports/portfolio');
    report.value = response.data.data;
    published.value = (await axiosInstance.get('/reports/published')).data.data;
  } catch (cause) {
    report.value = null;
    error.value = cause.response?.data?.message || 'Unable to load report. Check API connection and login.';
  } finally {
    loading.value = false;
  }
}
async function submitPublication() {
  if (!report.value) return;
  publicationNotice.value = '';
  publishing.value = true;
  try {
    await axiosInstance.post('/reviews/operations', { kind: 'REPORT_PUBLISH', values: {},
      summary: 'Executive portfolio snapshot ' + new Date().toISOString().slice(0, 10) });
    publicationNotice.value = 'Publication submitted. A separate PMO checker must approve the snapshot before export.';
  } catch (cause) {
    publicationNotice.value = cause.response?.data?.message || 'Unable to submit report for review.';
  } finally { publishing.value = false; }
}
function downloadCSV() {
  if (!selectedPublication.value) return;
  const escapeCell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const records = [
    ['Project', 'Client', 'Status', 'Health', 'Progress (%)', 'Completed tasks', 'Total tasks', 'Overdue tasks'],
    ...selectedPublication.value.snapshot.projects.map((project) => [
      project.name, project.client, project.status, project.health,
      project.progressPercent, project.completedTasks, project.totalTasks, project.overdueTasks
    ])
  ];
  const csv = records.map((record) => record.map(escapeCell).join(',')).join('\r\n');
  const objectURL = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = 'pmo-portfolio-' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(objectURL);
}
onMounted(loadReport);
</script>

<style scoped>
.report-detail-link{display:inline-flex;align-items:center;padding:10px 15px;background:#edf2fe;color:#315ac4;border-radius:9px;font-size:12px;font-weight:750;text-decoration:none}
.executive-reports { padding: 32px; background: #f5f7fb; min-height: 100vh; color: #1c2940; }
.report-heading { display:flex; justify-content:space-between; gap:24px; align-items:center; margin-bottom:24px; }
.report-heading h1 { font-size: 29px; font-weight: 750; margin:4px 0 8px; }
.report-eyebrow { color:#4c65b2; font-size:11px; font-weight:800; letter-spacing:.12em; }
.report-description { color:#65718a; font-size:14px; }
.report-actions { display:flex; gap:10px; }
.report-actions button, .report-notice button { border:1px solid #cfd8ea; border-radius:10px; padding:10px 16px; color:#3155a5; background:white; cursor:pointer; font-weight:600; }
.report-actions .primary { background:#2856bc; border-color:#2856bc; color:white; }
.report-actions button:disabled { opacity:.5; cursor:not-allowed; }
.report-notice { background:white; border:1px solid #d8e2f0; border-radius:12px; padding:18px; margin:12px 0; display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:13px; } .report-notice select { border:1px solid #d4dfee; border-radius:9px; padding:9px; background:#f8fafc; color:#263b5c; } .report-notice small { color:#64748b; }
.report-error { color:#ae2f49; }
.report-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin:24px 0; }
.report-metric { background:white; border:1px solid #e6eaf2; border-radius:16px; padding:21px; display:flex; flex-direction:column; gap:12px; }
.report-metric span { color:#607089; font-size:12px; font-weight:700; text-transform:uppercase; }
.report-metric strong { font-size:36px; color:#18345e; line-height:1; }
.report-metric small { font-size:12px; color:#66758f; }
.report-table-card { background:white; border:1px solid #e6eaf2; border-radius:16px; overflow:hidden; }
.report-table-heading { padding:24px 26px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
.report-table-heading h2 { font-size:20px; font-weight:700; }
.report-table-heading p { color:#7a879b; font-size:12px; }
.report-scroll { overflow-x:auto; }
table { width:100%; border-collapse:collapse; text-align:left; min-width:710px; }
th { background:#eef2f8; font-size:11px; letter-spacing:.03em; color:#67768d; text-transform:uppercase; padding:14px 26px; }
td { border-bottom:1px solid #eef1f6; padding:19px 26px; font-size:14px; }
td strong, td small { display:block; }
td small { color:#7e8a9a; margin-top:5px; }
td.empty { color:#748197; text-align:center; padding:45px 20px; }
.health { font-size:11px; font-weight:800; border-radius:20px; padding:6px 10px; background:#eff3f7; }
.health-green { background:#ddf8eb; color:#187e56; }
.health-amber { background:#fff0d5; color:#a56b13; }
.health-red { background:#ffdee5; color:#b43551; }
@media (max-width:1000px) { .report-metrics {grid-template-columns:repeat(2,minmax(0,1fr));} }
@media (max-width:650px) { .executive-reports {padding:18px;} .report-heading {flex-direction:column;align-items:stretch;} .report-metrics {grid-template-columns:1fr 1fr;} .report-metric {padding:15px;} .report-metric strong {font-size:28px;} .report-table-heading {flex-direction:column;align-items:start;} }
</style>
