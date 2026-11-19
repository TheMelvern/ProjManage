<template>
  <main class="executive-reports">
    <header class="report-heading">
      <div>
        <p class="report-eyebrow">PROJECT MANAGEMENT OFFICE</p>
        <h1>Executive status reports</h1>
        <p class="report-description">Portfolio health calculated from saved projects and task completion.</p>
      </div>
    </header>

    <p v-if="!liveMode" class="report-notice" role="status">
      Live reporting is not enabled. Set VITE_USE_LIVE_API=true and sign in with your local API account.
    </p>
    <p v-else-if="loading" class="report-notice" role="status">Loading portfolio report…</p>
    <div v-else-if="error" class="report-notice report-error" role="alert">
      {{ error }}{{ report ? ' Showing the last available portfolio.' : '' }}
      <button type="button" @click="loadReport">Try again</button>
    </div>

    <p v-if="publicationNotice" class="report-notice" :role="publicationFailed ? 'alert' : 'status'">
      {{ publicationNotice }}
      <router-link v-if="submittedId" :to="{name:'ReportApprovals',params:{requestId:submittedId}}">Open submitted snapshot</router-link>
    </p>
    <PremiumComposeDialog :open="confirmPublication" title="Submit executive snapshot" description="The portal captures a new version when you submit. An independent checker reviews that version before it can be downloaded." @close="confirmPublication=false">
      <p v-if="!report?.projects.length">The live portfolio currently has no projects. The snapshot may contain no records.</p>
      <button type="button" class="pmo-control primary" :disabled="publishing" @click="submitPublication">{{ publishing ? 'Submitting…' : 'Submit snapshot' }}</button>
    </PremiumComposeDialog>
    <section v-if="liveMode" class="report-notice publication-panel" aria-labelledby="approved-heading">
      <div class="pmo-action-group"><h2 id="approved-heading">Approved snapshots</h2>
        <button type="button" class="pmo-control quiet" :disabled="publicationsLoading" @click="loadPublications">Refresh snapshots</button>
      </div>
      <p v-if="publicationsLoading" role="status">Loading approved snapshots…</p>
      <p v-if="publicationsError" role="alert">{{ publicationsError }}{{ published.length ? ' Showing the last available snapshots.' : '' }} Use Refresh snapshots to retry.</p>
      <p v-if="!publicationsLoading && publicationsLoaded && !published.length">No approved snapshots yet. A checker must approve a submitted snapshot before export.</p>
      <template v-if="published.length">
        <SmartSelect id="approved-report" v-model="publicationId" aria-label="Approved executive snapshots" :options="published.map(item=>({value:item.id,label:item.summary+' · '+formatDate(item.reviewedAt)}))" />
        <button v-if="selectedPublication" type="button" class="pmo-control" @click="downloadCSV">Download CSV</button>
        <PortfolioSnapshot v-if="selectedPublication" :data="selectedPublication.snapshot" title="Selected approved snapshot" />
      </template>
    </section>
    <div v-if="liveMode" class="pmo-action-group live-report-actions">
      <div><h2>Live portfolio</h2><p v-if="report">Updated {{ formatDate(report.generatedAt) }}</p></div>
      <div class="pmo-action-group">
        <button type="button" class="pmo-control quiet" @click="loadReport" :disabled="loading">Refresh live portfolio</button>
        <button type="button" class="pmo-control primary" @click="startPublication" :disabled="!report || publishing">Submit snapshot for review</button>
      </div>
    </div>
    <section v-if="report && !report.projects.length" class="work-empty">
      <span class="record-icon material-symbols-outlined" aria-hidden="true">monitoring</span>
      <div><h2>No projects to report yet</h2><p>Approved projects will appear in the live portfolio.</p></div>
      <router-link class="pmo-control quiet" to="/projects">View projects and requests</router-link>
    </section>
    <template v-else-if="report">
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
                <td><router-link class="queue-record" :to="{path:'/reports/detail',query:{projectId:project.id}}">{{ project.name }}</router-link><small v-if="project.client">{{ project.client }}</small></td>
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
  </main>
</template>

<script setup>
import PortfolioSnapshot from '../../../../components/PortfolioSnapshot.vue';
import PremiumComposeDialog from '../../../../components/PremiumComposeDialog.vue';
import { snapshotCSV } from '../../../../utils/portfolioSnapshot';
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
const publicationFailed = ref(false);
const submittedId = ref('');
const confirmPublication = ref(false);
const publicationsLoading = ref(false);
const publicationsLoaded = ref(false);
const publicationsError = ref('');
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
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Unable to load report. Check API connection and login.';
  } finally {
    loading.value = false;
  }
}
async function loadPublications() {
  if (!liveMode || publicationsLoading.value) return;
  publicationsLoading.value = true;
  publicationsError.value = '';
  try {
    published.value = (await axiosInstance.get('/reports/published')).data.data;
    publicationsLoaded.value = true;
    if (!selectedPublication.value) publicationId.value = published.value[0]?.id || '';
  } catch {
    publicationsError.value = 'Approved snapshots could not be loaded.';
  } finally {
    publicationsLoading.value = false;
  }
}
function startPublication() {
  if (!report.value || publishing.value) return;
  if (!report.value.projects.length) confirmPublication.value = true;
  else submitPublication();
}
async function submitPublication() {
  if (!report.value || publishing.value) return;
  confirmPublication.value = false;
  submittedId.value = '';
  publicationFailed.value = false;
  publicationNotice.value = '';
  publishing.value = true;
  try {
    const { data } = await axiosInstance.post('/reviews/operations', { kind: 'REPORT_PUBLISH', values: {},
      summary: 'Executive portfolio snapshot ' + new Date().toISOString().slice(0, 10) });
    submittedId.value = data.data.id;
    publicationNotice.value = 'Publication submitted. A separate PMO checker must approve the snapshot before export.';
  } catch (cause) {
    publicationFailed.value = true;
    publicationNotice.value = cause.response?.data?.message || 'Unable to submit report for review.';
  } finally { publishing.value = false; }
}
function downloadCSV() {
  if (!selectedPublication.value) return;
  const csv = snapshotCSV(selectedPublication.value.snapshot);
  const objectURL = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = 'pmo-portfolio-' + selectedPublication.value.snapshot.generatedAt.slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(objectURL);
}
onMounted(() => { loadReport(); loadPublications(); });
</script>

<style scoped>
.report-detail-link{display:inline-flex;align-items:center;padding:10px 15px;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);border-radius:9px;font-size:12px;font-weight:750;text-decoration:none}
.executive-reports { padding: 32px; background:var(--pmo-accent-soft); min-height: 100vh; color:var(--pmo-text); }
.report-heading { display:flex; justify-content:space-between; gap:24px; align-items:center; margin-bottom:24px; }
.report-heading h1 { font-size: 29px; font-weight: 750; margin:4px 0 8px; }
.report-eyebrow { color:var(--pmo-accent-ink); font-size:11px; font-weight:800; letter-spacing:.12em; }
.report-description { color:#65718a; font-size:14px; }
.report-actions { display:flex; gap:10px; flex-wrap:wrap; min-inline-size:0; }
.publication-panel{display:grid;justify-items:start;min-inline-size:0}
.publication-panel > *{max-inline-size:100%}
.publication-panel .snapshot{inline-size:100%}
@media(max-width:600px){.report-actions .primary{flex-basis:100%}}
.report-actions button, .report-notice button { border:1px solid var(--pmo-border); border-radius:10px; padding:10px 16px; color:var(--pmo-accent-ink); background:white; cursor:pointer; font-weight:600; }
.report-actions .primary { background:var(--pmo-accent); border-color:var(--pmo-accent); color:var(--pmo-on-accent); }
.report-actions button:disabled { opacity:.5; cursor:not-allowed; }
.report-notice { background:white; border:1px solid var(--pmo-border); border-radius:12px; padding:18px; margin:12px 0; display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:13px; } .report-notice select { border:1px solid var(--pmo-border); border-radius:9px; padding:9px; background:var(--pmo-accent-soft); color:var(--pmo-text); } .report-notice small { color:#64748b; }
.report-error { color:#ae2f49; }
.report-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin:24px 0; }
.report-metric { background:white; border:1px solid var(--pmo-border); border-radius:16px; padding:21px; display:flex; flex-direction:column; gap:12px; }
.report-metric span { color:#607089; font-size:12px; font-weight:700; text-transform:uppercase; }
.report-metric strong { font-size:36px; color:var(--pmo-text); line-height:1; }
.report-metric small { font-size:12px; color:#66758f; }
.report-table-card { background:white; border:1px solid var(--pmo-border); border-radius:16px; overflow:hidden; }
.report-table-heading { padding:24px 26px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
.report-table-heading h2 { font-size:20px; font-weight:700; }
.report-table-heading p { color:#7a879b; font-size:12px; }
.report-scroll { overflow-x:auto; }
table { width:100%; border-collapse:collapse; text-align:left; min-width:710px; }
th { background:var(--pmo-accent-soft); font-size:11px; letter-spacing:.03em; color:#67768d; text-transform:uppercase; padding:14px 26px; }
td { border-bottom:1px solid var(--pmo-border); padding:19px 26px; font-size:14px; }
td strong, td small { display:block; }
td small { color:#7e8a9a; margin-top:5px; }
td.empty { color:#748197; text-align:center; padding:45px 20px; }
.health { font-size:11px; font-weight:800; border-radius:20px; padding:6px 10px; background:var(--pmo-accent-soft); }
.health-green { background:#ddf8eb; color:#187e56; }
.health-amber { background:#fff0d5; color:#a56b13; }
.health-red { background:#ffdee5; color:#b43551; }
@media (max-width:1000px) { .report-metrics {grid-template-columns:repeat(2,minmax(0,1fr));} }
@media (max-width:650px) { .executive-reports {padding:18px;} .report-heading {flex-direction:column;align-items:stretch;} .report-metrics {grid-template-columns:1fr 1fr;} .report-metric {padding:15px;} .report-metric strong {font-size:28px;} .report-table-heading {flex-direction:column;align-items:start;} }
</style>
