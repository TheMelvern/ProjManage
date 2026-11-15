<template>
  <main class="workspace">
    <header class="workspace-header">
      <div>
        <p class="eyebrow">PMO DELIVERY WORKSPACE</p>
        <h1>Projects & tasks</h1>
        <p>Manage delivery records that power your executive status reports.</p>
      </div>
      <div class="module-shortcuts"><router-link to="/projects/detail" class="report-link">View details</router-link><router-link to="/reports" class="report-link">Open reports</router-link></div>
    </header>

    <p v-if="!liveMode" class="notice" role="status">
      Connect your local API and set VITE_USE_LIVE_API=true to use the persistent workspace.
    </p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="success" class="notice success" role="status">{{ success }}</p>

    <div class="workspace-layout">
      <section class="workspace-card project-list">
        <div class="section-heading">
          <h2>Projects</h2>
          <span>{{ projects.length }} total</span>
        </div>
        <form class="create-form" @submit.prevent="createProject">
          <label for="project-name">New project name</label>
          <input id="project-name" v-model.trim="newProjectName" required minlength="2" maxlength="140"
            placeholder="e.g. Customer Portal Rollout" :disabled="!liveMode || busy" />
          <label for="project-client">Client (optional)</label>
          <input id="project-client" v-model.trim="newClient" maxlength="140"
            placeholder="Organization name" :disabled="!liveMode || busy" />
          <button type="submit" :disabled="!liveMode || busy || newProjectName.length < 2">Submit project</button>
        </form>
        <div v-if="loading" class="loading" role="status">Loading projects…</div>
        <div v-else-if="projects.length === 0" class="loading">No projects created yet.</div>
        <div v-else class="project-choices" role="list">
          <button v-for="project in projects" :key="project.id" type="button"
            :class="{ selected: project.id === selectedId }" @click="selectProject(project.id)">
            <strong>{{ project.name }}</strong>
            <small>{{ project.client || 'No client' }}</small>
            <span class="project-status">{{ formatLabel(project.status) }}</span>
          </button>
        </div>
      </section>

      <section class="workspace-card project-detail">
        <template v-if="selectedProject">
          <div class="section-heading"><h2>{{ selectedProject.name }}</h2><span>{{ tasks.length }} tasks</span></div>
          <p class="detail-desc">{{ selectedProject.description || 'Project delivery and milestone tracking.' }}</p>
          <form class="detail-settings" @submit.prevent="saveProject">
            <div>
              <label for="project-status">Status</label>
              <select id="project-status" v-model="projectStatus" :disabled="!liveMode || busy">
                <option v-for="status in projectStatuses" :key="status" :value="status">{{ formatLabel(status) }}</option>
              </select>
            </div>
            <div>
              <label for="project-health">Health</label>
              <select id="project-health" v-model="projectHealth" :disabled="!liveMode || busy">
                <option v-for="health in projectHealthOptions" :key="health" :value="health">{{ formatLabel(health) }}</option>
              </select>
            </div>
            <button type="submit" :disabled="!liveMode || busy">Submit for check</button>
          </form>
          <div class="task-header"><h3>Delivery tasks</h3><span>{{ progress }}% complete</span></div>
          <div class="progress-track" :aria-label="progress + '% of tasks completed'" role="progressbar"
            :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <form class="task-create" @submit.prevent="createTask">
            <label for="task-title">New task</label>
            <input id="task-title" v-model.trim="newTaskTitle" placeholder="Task or deliverable name"
              minlength="2" maxlength="200" required :disabled="!liveMode || busy" />
            <label for="task-due">Due date (optional)</label>
            <input id="task-due" v-model="newTaskDue" type="date" :disabled="!liveMode || busy" />
            <button type="submit" :disabled="!liveMode || busy || newTaskTitle.length < 2">Submit task</button>
          </form>
          <ul class="tasks">
            <li v-for="task in tasks" :key="task.id">
              <div class="task-details">
                <strong>{{ task.title }}</strong>
                <small>{{ task.dueDate ? 'Due ' + formatDate(task.dueDate) : 'No due date' }}</small>
              </div>
              <label :for="'task-status-' + task.id">Status</label>
              <select :id="'task-status-' + task.id" :value="task.status"
                :disabled="!liveMode || busy" @change="changeTaskStatus(task, $event.target.value)">
                <option v-for="status in taskStatuses" :key="status" :value="status">{{ formatLabel(status) }}</option>
              </select>
            </li>
            <li v-if="tasks.length === 0" class="task-empty">No tasks logged yet. Add a delivery task to measure progress.</li>
          </ul>
        </template>
        <div v-else class="empty-project">Select a project to manage health, progress and delivery tasks.</div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import axiosInstance from '../../../api/axiosConfig';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const loading = ref(false), busy = ref(false), error = ref(''), success = ref('');
const projects = ref([]), selectedId = ref(null), tasks = ref([]);
const newProjectName = ref(''), newClient = ref(''), newTaskTitle = ref(''), newTaskDue = ref('');
const projectStatus = ref('PLANNING'), projectHealth = ref('UNKNOWN');
const projectStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const projectHealthOptions = ['UNKNOWN', 'GREEN', 'AMBER', 'RED'];
const taskStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const selectedProject = computed(() => projects.value.find(project => project.id === selectedId.value) || null);
const progress = computed(() => tasks.value.length
  ? Math.round(tasks.value.filter(task => task.status === 'DONE').length / tasks.value.length * 100)
  : 0);
const formatLabel = value => String(value).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const formatDate = value => new Date(value).toLocaleDateString();

function showError(cause) {
  error.value = cause.response?.data?.message || cause.message || 'The operation failed.';
  success.value = '';
}
function showSuccess(message) {
  success.value = message;
  error.value = '';
}
async function loadProjects() {
  if (!liveMode) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await axiosInstance.get('/projects');
    projects.value = response.data.data;
    if (!projects.value.some(p => p.id === selectedId.value)) {
      selectedId.value = projects.value[0]?.id || null;
    }
    projectStatus.value = selectedProject.value?.status || 'PLANNING';
    projectHealth.value = selectedProject.value?.health || 'UNKNOWN';
    await loadTasks();
  } catch (cause) { showError(cause); } finally { loading.value = false; }
}
async function loadTasks() {
  if (!selectedId.value) { tasks.value = []; return; }
  const response = await axiosInstance.get('/projects/' + encodeURIComponent(selectedId.value) + '/tasks');
  tasks.value = response.data.data;
}
async function selectProject(id) {
  selectedId.value = id;
  projectStatus.value = selectedProject.value?.status || 'PLANNING';
  projectHealth.value = selectedProject.value?.health || 'UNKNOWN';
  try { await loadTasks(); } catch (cause) { showError(cause); }
}
async function createProject() {
  busy.value = true;
  try {
    await axiosInstance.post('/reviews/operations', {
      kind: 'PROJECT_CREATE', summary: 'Create project ' + newProjectName.value,
      values: { name: newProjectName.value, client: newClient.value }
    });
    newProjectName.value = '';
    newClient.value = '';
    showSuccess('Project proposal submitted for independent approval.');
  } catch (cause) { showError(cause); } finally { busy.value = false; }
}
async function saveProject() {
  if (!selectedId.value) return;
  busy.value = true;
  try {
    await axiosInstance.post('/reviews/projects', {
      projectId: selectedId.value, status: projectStatus.value, health: projectHealth.value,
      summary: 'Review delivery status for ' + selectedProject.value.name
    });
    showSuccess('Project change submitted for independent approval. It will not affect reports until approved.');
  } catch (cause) { showError(cause); } finally { busy.value = false; }
}
async function createTask() {
  if (!selectedId.value) return;
  busy.value = true;
  try {
    await axiosInstance.post('/reviews/operations', {
      kind: 'TASK_CREATE', projectId: selectedId.value,
      summary: 'Create task ' + newTaskTitle.value,
      values: {
        title: newTaskTitle.value,
        ...(newTaskDue.value ? { dueDate: new Date(newTaskDue.value + 'T12:00:00').toISOString() } : {})
      }
    });
    newTaskTitle.value = '';
    newTaskDue.value = '';
    showSuccess('Task proposal submitted for independent approval.');
  } catch (cause) { showError(cause); } finally { busy.value = false; }
}
async function changeTaskStatus(task, status) {
  busy.value = true;
  try {
    await axiosInstance.post('/reviews/operations', {
      kind: 'TASK_UPDATE', projectId: selectedId.value, targetId: task.id,
      summary: 'Update task status for ' + task.title, values: { status }
    });
    showSuccess('Task change submitted for independent approval.');
  } catch (cause) { showError(cause); } finally { busy.value = false; }
}
onMounted(loadProjects);
</script>

<style scoped>
.module-shortcuts{display:flex;gap:9px;flex-wrap:wrap}
.workspace {background:#f4f7fb;min-height:100vh;padding:34px;color:#192943;}
.workspace-header {display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:26px;}
.eyebrow {font-weight:800;letter-spacing:.1em;color:#4260b0;font-size:11px;}
.workspace-header h1 {font-size:30px;font-weight:750;margin:5px 0;}
.workspace-header p:not(.eyebrow) {color:#71809a;font-size:14px;}
.report-link {color:#345ac2;font-weight:700;text-decoration:none;background:white;padding:12px 18px;border-radius:10px;white-space:nowrap;}
.notice {background:#edf3fe;color:#3b58a2;padding:15px 20px;border-radius:10px;margin:0 0 22px;font-size:13px;}
.notice.error {background:#ffebee;color:#ad2f4b;}
.notice.success {background:#e6f9ee;color:#166b4d;}
.workspace-layout {display:grid;grid-template-columns:minmax(300px,370px) minmax(0,1fr);gap:22px;align-items:start;}
.workspace-card {background:#fff;border-radius:18px;padding:25px;border:1px solid #e7ebf2;}
.section-heading {display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;}
.section-heading h2 {font-size:20px;font-weight:750;margin:0;}
.section-heading span,.task-header span {color:#75839a;font-size:12px;}
.create-form,.task-create {display:flex;flex-direction:column;gap:9px;}
label {color:#566881;font-size:12px;font-weight:700;}
input,select {border:1px solid #d8e0eb;border-radius:9px;padding:11px 13px;background:#fff;color:#273a57;min-width:0;font:inherit;font-size:13px;}
input:focus-visible,select:focus-visible,button:focus-visible {outline:3px solid #a8bfff;outline-offset:2px;}
form button {margin-top:9px;background:#315ac4;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;}
button:disabled {opacity:.5;cursor:not-allowed;}
.project-choices {display:flex;flex-direction:column;gap:9px;margin-top:22px;}
.project-choices button {display:flex;flex-direction:column;align-items:start;text-align:left;gap:5px;padding:13px 15px;border:1px solid #e3e8f1;border-radius:11px;background:#fff;cursor:pointer;}
.project-choices button.selected {border-color:#547ae2;background:#eff4ff;}
.project-choices strong {font-size:13px;color:#22344f;}
.project-choices small {font-size:12px;color:#72829a;}
.project-status {color:#4266b7;font-weight:700;font-size:11px;}
.loading,.empty-project {color:#78879b;padding:26px 0;font-size:14px;}
.detail-desc {color:#738198;font-size:14px;margin-top:-9px;}
.detail-settings {display:flex;gap:12px;align-items:end;padding:20px 0;border-bottom:1px solid #ecf0f4;}
.detail-settings > div {display:flex;flex-direction:column;gap:8px;flex:1;}
.detail-settings button {white-space:nowrap;}
.task-header {display:flex;justify-content:space-between;align-items:center;margin-top:26px;}
.task-header h3 {font-size:17px;font-weight:750;}
.progress-track {height:8px;background:#e9effa;border-radius:10px;overflow:hidden;margin:12px 0 22px;}
.progress-fill {height:100%;background:#315ac4;transition:width .2s;}
.task-create {padding:18px;border:1px solid #e6ebf4;border-radius:12px;background:#fafcff;}
.tasks {padding:0;margin:20px 0 0;list-style:none;}
.tasks li {padding:14px 0;border-bottom:1px solid #eff2f6;display:flex;align-items:center;gap:12px;}
.task-details {flex:1;min-width:0;}
.task-details strong {display:block;font-size:13px;word-break:break-word;}
.task-details small {display:block;color:#77859b;font-size:12px;margin-top:6px;}
.tasks select {max-width:146px;}
.tasks li.task-empty {color:#77859b;font-size:13px;}
@media(max-width:1000px){.workspace-layout{grid-template-columns:1fr;}}
@media(max-width:600px){.workspace{padding:16px}.workspace-header{flex-direction:column;align-items:start}.workspace-card{padding:18px}.detail-settings{flex-direction:column;align-items:stretch}.tasks li{flex-wrap:wrap}.tasks select{max-width:none;}}
</style>
