<template>
  <main class="portfolio-page">
    <header class="portfolio-header">
      <div>
        <h1>Portfolio Overview</h1>
        <p>Project health, delivery progress and executive priorities.</p>
      </div>
      <div class="header-actions">
        <span class="portfolio-date">{{ periodLabel }}</span>
        <button type="button" @click="load" :disabled="loading">Refresh</button>
      </div>
    </header>

    <p v-if="!liveMode" class="portfolio-message" role="status">
      Connect your local API and enable VITE_USE_LIVE_API=true to see real portfolio data.
    </p>
    <p v-else-if="loading" class="portfolio-message" role="status">Loading portfolio metrics…</p>
    <p v-else-if="error" class="portfolio-message error" role="alert">{{ error }}</p>

    <div class="portfolio-kpis">
      <article v-for="item in kpis" :key="item.label" class="kpi-card">
        <span>{{ item.label }}</span>
        <strong :class="item.tone">{{ item.value }}</strong>
        <small>{{ item.detail }}</small>
      </article>
    </div>

    <div class="portfolio-columns">
      <section class="portfolio-panel">
        <div class="panel-heading">
          <h2>Portfolio health</h2>
          <p>Calculated from persisted project and task records</p>
        </div>
        <div class="portfolio-table-wrap">
          <table>
            <thead><tr>
              <th scope="col">Project</th>
              <th scope="col">Health</th>
              <th scope="col">Progress</th>
              <th scope="col">Overdue</th>
              <th scope="col">Open risks</th>
            </tr></thead>
            <tbody>
              <tr v-for="project in projects" :key="project.id">
                <td><strong>{{ project.name }}</strong><small>{{ project.client || 'No client' }}</small></td>
                <td><span class="health-label" :class="'tone-' + project.health.toLowerCase()">{{ project.health }}</span></td>
                <td>{{ project.progressPercent }}%</td>
                <td>{{ project.overdueTasks }}</td>
                <td>{{ project.openRisks ?? 0 }}</td>
              </tr>
              <tr v-if="projects.length === 0">
                <td colspan="5" class="empty-cell">{{ liveMode && !loading ? 'No project records found.' : 'Connect live data to populate this portfolio.' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <router-link class="panel-link" to="/reports">View executive reports</router-link>
      </section>

      <section class="portfolio-panel priority-panel">
        <div class="panel-heading">
          <h2>Executive focus</h2>
          <p>Automatically prioritized areas for review</p>
        </div>
        <ol v-if="priorities.length" class="priority-list">
          <li v-for="(item, index) in priorities" :key="item.id">
            <span class="priority-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.subtitle }}</small>
            </div>
          </li>
        </ol>
        <p v-else class="focus-empty">
          {{ liveMode && !loading && report ? 'No immediate critical or overdue project actions identified.' : 'Priorities appear when project data is available.' }}
        </p>
      </section>
    </div>
    <p class="portfolio-timestamp" v-if="report">Report generated {{ generatedLabel }}</p>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import axiosInstance from '../../../../api/axiosConfig';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const report = ref(null);
const loading = ref(false);
const error = ref('');

const periodLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
const projects = computed(() => report.value?.projects || []);
const summary = computed(() => report.value?.summary || {});
const generatedLabel = computed(() => report.value?.generatedAt
  ? new Date(report.value.generatedAt).toLocaleString()
  : '');

const kpis = computed(() => [
  { label: 'Active projects', value: summary.value.activeProjects ?? '—', detail: 'Currently underway', tone: 'blue' },
  { label: 'On track', value: report.value ? projects.value.filter(p => p.health === 'GREEN').length : '—', detail: 'Green project health', tone: 'green' },
  { label: 'At risk', value: report.value ? projects.value.filter(p => p.health === 'AMBER').length : '—', detail: 'Need timely review', tone: 'amber' },
  { label: 'Critical', value: report.value ? projects.value.filter(p => p.health === 'RED').length : '—', detail: 'Immediate escalation', tone: 'red' }
]);

const priorities = computed(() => {
  const ranked = projects.value
    .filter(project => project.overdueTasks > 0 || project.highRisks > 0 ||
      project.openIssues > 0 || ['AMBER', 'RED'].includes(project.health))
    .map(project => ({
      id: project.id,
      order: project.health === 'RED' || project.highRisks > 0 ? 0 :
        project.overdueTasks > 0 || project.openIssues > 0 ? 1 : 2,
      title: project.highRisks > 0
        ? 'Mitigate ' + project.highRisks + ' high-severity risk' + (project.highRisks === 1 ? '' : 's')
        : project.overdueTasks > 0
          ? 'Resolve ' + project.overdueTasks + ' overdue task' + (project.overdueTasks === 1 ? '' : 's')
          : project.openIssues > 0
            ? 'Resolve ' + project.openIssues + ' open issue' + (project.openIssues === 1 ? '' : 's')
            : 'Review ' + project.health.toLowerCase() + ' project health',
      subtitle: project.name
    }))
    .sort((a, b) => a.order - b.order);
  return ranked.slice(0, 4);
});

async function load() {
  if (!liveMode) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await axiosInstance.get('/reports/portfolio');
    report.value = response.data.data;
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Unable to retrieve portfolio data. Check your session and API.';
    report.value = null;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.portfolio-crosslinks{display:flex;gap:10px;flex-wrap:wrap;margin:23px 0}.portfolio-crosslinks a{padding:11px 14px;background:#eaf0fd;color:#315ac4;border-radius:9px;text-decoration:none;font-size:12px;font-weight:750}
.portfolio-page { padding:34px 36px 44px; background:#f4f7fb; min-height:100vh; color:#18253c; }
.portfolio-header { background:#fff; border-radius:18px; padding:22px 30px; display:flex; justify-content:space-between; gap:18px; align-items:center; }
.portfolio-header h1 { font-size:30px; line-height:1.2; font-weight:750; margin:0 0 8px; }
.portfolio-header p {font-size:13px; color:#64748b; margin:0;}
.header-actions {display:flex;align-items:center; gap:12px;}
.portfolio-date {display:inline-block;padding:12px 20px;background:#eaf0ff;color:#345ac2;font-size:12px;letter-spacing:.04em;font-weight:700;border-radius:11px;white-space:nowrap;}
.header-actions button {padding:10px 14px; background:#fff;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;color:#3159ac;}
.portfolio-message {margin:20px 0 0;background:#eaf0ff;border-radius:12px;padding:15px 20px;color:#344b83;font-size:13px;}
.portfolio-message.error {background:#fff0f2;color:#bb3d55;}
.portfolio-kpis {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin:28px 0 30px;}
.kpi-card {background:#fff;border-radius:18px;padding:24px;min-height:146px;display:flex;flex-direction:column;gap:13px;}
.kpi-card span {font-size:12px;font-weight:750;letter-spacing:.03em;text-transform:uppercase;color:#65748b;}
.kpi-card strong {font-size:40px;line-height:1.15;}
.kpi-card small {font-size:12px;color:#6d7b90;}
.kpi-card .blue {color:#2253cb;} .kpi-card .green {color:#16805d;} .kpi-card .amber {color:#d67d14;} .kpi-card .red {color:#cb4356;}
.portfolio-columns {display:grid;grid-template-columns:minmax(0,1.9fr) minmax(300px,1fr);gap:22px;}
.portfolio-panel {background:white;border-radius:18px;min-width:0;padding:24px 26px;min-height:480px;}
.panel-heading h2 {font-size:22px;font-weight:750;margin:0 0 7px;}
.panel-heading p {font-size:13px;color:#64748b;margin:0 0 27px;}
.portfolio-table-wrap {overflow-x:auto;}
table {width:100%;border-collapse:collapse;min-width:540px;text-align:left;}
th {background:#f3f6fb;color:#64748b;font-weight:750;font-size:11px;text-transform:uppercase;padding:16px 12px;}
td {padding:20px 12px;color:#31425c;border-bottom:1px solid #eff2f7;font-size:13px;}
td strong {display:block;font-size:14px;}
td small {display:block;font-size:12px;color:#8b96a9;margin-top:5px;}
.empty-cell {text-align:center;color:#64748b;padding:50px 12px;}
.health-label {font-size:11px;font-weight:800;border-radius:8px;padding:6px 9px;background:#edf1f7;color:#56677e;}
.tone-green {color:#15805a;background:#e3f8ee;} .tone-amber {color:#b7730e;background:#fff2df;} .tone-red {color:#bc3c56;background:#ffe6eb;}
.panel-link {display:inline-block;color:#345ac2;font-size:13px;font-weight:700;margin-top:24px;}
.priority-list {list-style:none;padding:0;margin:29px 0;display:flex;flex-direction:column;gap:26px;}
.priority-list li {display:flex;gap:14px;align-items:flex-start;}
.priority-number {background:#eef3ff;color:#315dc8;border-radius:10px;padding:11px;font-size:13px;font-weight:750;}
.priority-list strong {display:block;font-size:15px;line-height:1.4;}
.priority-list small {display:block;color:#718096;margin-top:10px;font-size:12px;}
.focus-empty {color:#718096;font-size:14px;line-height:1.6;}
.portfolio-timestamp {font-size:12px;color:#8290a5;margin-top:22px;}
@media(max-width:1050px) {.portfolio-kpis {grid-template-columns:repeat(2,minmax(0,1fr));}.portfolio-columns {grid-template-columns:1fr;}.portfolio-panel{min-height:auto;}}
@media(max-width:650px) {.portfolio-page{padding:16px}.portfolio-header{padding:20px;align-items:flex-start;flex-direction:column}.portfolio-header h1{font-size:24px}.portfolio-kpis{gap:10px;margin:15px 0}.kpi-card{padding:15px;min-height:125px}.kpi-card strong{font-size:29px}.kpi-card span{font-size:10px}.portfolio-panel{padding:18px}}
</style>
