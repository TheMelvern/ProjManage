<template>
  <main class="workspace">
    <header class="workspace-header">
      <div>
        <h1>Projects & tasks</h1>
        <p>Plan delivery and track project requests across your workspace.</p>
      </div>
      <router-link to="/projects/new" class="create-project-action"><span class="material-symbols-outlined" aria-hidden="true">add</span>Create project</router-link>
    </header>

    <p v-if="!liveMode" class="notice" role="status">
      Connect your local API and set VITE_USE_LIVE_API=true to use the persistent workspace.
    </p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="success" class="notice success" role="status">{{ success }}</p>

    <section v-if="liveMode" class="workspace-card requests" aria-labelledby="my-project-requests">
      <h2 id="my-project-requests">My project requests</h2>
      <p v-if="requestsLoading" role="status">Loading your requests…</p>
      <p v-else-if="requestsError" role="alert">Could not load requests. <button type="button" @click="loadRequests">Retry</button></p>
      <p v-else-if="!requests.length">You have no project creation requests.</p>
      <ul v-else>
        <li v-for="request in requests" :key="request.id">
          <router-link class="request-row" :to="{ name: 'ProjectApprovals', params: { requestId: request.id } }">
            <span class="record-icon material-symbols-outlined" aria-hidden="true">description</span>
            <strong>{{ request.proposed?.values?.name || request.summary }}</strong>
            <span class="record-state" :data-state="request.status">{{ request.status === 'PENDING' ? 'Pending review' : formatLabel(request.status) }}</span>
          <time v-if="request.updatedAt || request.createdAt" :datetime="request.updatedAt || request.createdAt">Updated {{ formatRequestDate(request.updatedAt || request.createdAt) }}</time>
            <span class="material-symbols-outlined row-arrow" aria-hidden="true">chevron_right</span>
          </router-link>
        </li>
      </ul>
    </section>
    <div class="project-overview">
      <section class="workspace-card project-list">
        <div class="section-heading">
          <h2>Active projects</h2>
          <span>{{ projects.length }} total</span>
        </div>
        <form v-if="false" class="create-form" @submit.prevent="createProject">
          <label for="project-name">New project name</label>
          <input id="project-name" v-model.trim="newProjectName" required minlength="2" maxlength="140"
            placeholder="e.g. Customer Portal Rollout" :disabled="!liveMode || busy" />
          <label for="project-client">Client (optional)</label>
          <input id="project-client" v-model.trim="newClient" maxlength="140"
            placeholder="Organization name" :disabled="!liveMode || busy" />
          <button type="submit" :disabled="!liveMode || busy || newProjectName.length < 2">Submit project</button>
        </form>
        <div v-if="loading" class="loading" role="status">Loading projects…</div>
        <div v-else-if="!error && projects.length === 0" class="empty-project-landing"><span class="record-icon material-symbols-outlined" aria-hidden="true">folder_open</span><div><h3>No active projects yet</h3><p>Approved projects will appear here and become available for delivery, RAID and timesheets.</p></div></div>
        <ul v-else-if="projects.length" class="project-records">
          <li v-for="project in projects" :key="project.id">
            <router-link class="project-record-link" :to="{ name: 'ProjectHub', params: { id: project.id } }">
              <span class="record-icon material-symbols-outlined" aria-hidden="true">folder_open</span>
              <span class="project-identity"><strong>{{ project.name }}</strong><small v-if="project.client">{{ project.client }}</small></span>
              <span class="record-state" :data-state="project.health">{{ { GREEN: 'On track', AMBER: 'At risk', RED: 'Critical' }[project.health] || formatLabel(project.status) }}</span>
              <span class="project-target"><span v-if="project.targetEndDate">Target {{ formatRequestDate(project.targetEndDate) }}</span><span>{{ project._count?.tasks ?? 0 }} work items</span></span>
              <span class="material-symbols-outlined project-arrow" aria-hidden="true">chevron_right</span>
            </router-link>
            <button type="button" class="project-quick-view" :aria-expanded="project.id === selectedId" aria-controls="project-quick-details" @click="selectProject(project.id)">Quick view</button>
          </li>
        </ul>
      </section>

      </div>
    <div v-if="selectedProject" id="project-quick-details" class="workspace-layout">
      <section class="workspace-card project-detail">
        <template v-if="selectedProject">
          <router-link class="project-workspace-link" :to="'/projects/'+encodeURIComponent(selectedProject.id)+'/workspace'">Open project workspace →</router-link>
          <div class="section-heading"><h2>{{ selectedProject.name }}</h2><span>{{ tasks.length }} tasks</span></div>
          <p class="detail-desc">{{ selectedProject.description || 'Project delivery and milestone tracking.' }}</p>
          <form class="detail-settings" @submit.prevent="saveProject">
            <div>
              <label for="project-status">Status</label>
              <SmartSelect id="project-status" v-model="projectStatus" aria-label="Status" :disabled="!liveMode || busy" :options="projectStatuses.map(v => ({value:v,label:formatLabel(v)}))" />
            </div>
            <div>
              <label for="project-health">Health</label>
              <SmartSelect id="project-health" v-model="projectHealth" aria-label="Health" :disabled="!liveMode || busy" :options="projectHealthOptions.map(v => ({value:v,label:formatLabel(v)}))" />
            </div>
            <button type="submit" :disabled="!liveMode || busy">Submit for check</button>
          </form>
          <div class="task-header"><h3>Delivery tasks</h3><span>{{ progress }}% complete</span></div>
          <div class="progress-track" :aria-label="progress + '% of tasks completed'" role="progressbar"
            :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <button type="button" class="premium-add-trigger" @click="composeOpen=true"><span class="material-symbols-outlined" aria-hidden="true">add_circle</span> Add delivery task</button>
          <PremiumComposeDialog :open="composeOpen" title="New delivery task" eyebrow="PROJECTS / TASKS" description="Create a deliverable for independent approval. Use the project workspace for stories, priorities and dependencies." :error="error" @close="composeOpen=false">
          <form class="task-create" @submit.prevent="createTask">
            <label for="task-title">New task</label>
            <input id="task-title" v-model.trim="newTaskTitle" placeholder="Task or deliverable name"
              minlength="2" maxlength="200" required :disabled="!liveMode || busy" />
            <label for="task-due">Due date (optional)</label>
            <SmartDatePicker id="task-due" v-model="newTaskDue" aria-label="Due date (optional)" :disabled="!liveMode || busy" />
            <button type="submit" :disabled="!liveMode || busy || newTaskTitle.length < 2">Submit task</button>
          </form>
          </PremiumComposeDialog>
          <ul class="tasks">
            <li v-for="task in tasks" :key="task.id">
              <div class="task-details">
                <strong>{{ task.title }}</strong>
                <small>{{ task.dueDate ? 'Due ' + formatDate(task.dueDate) : 'No due date' }}</small>
              </div>
              <label :for="'task-status-' + task.id">Status</label>
              <SmartSelect :id="'task-status-' + task.id" :model-value="task.status" aria-label="Status" :disabled="!liveMode || busy" :options="taskStatuses.map(v => ({value:v,label:formatLabel(v)}))" @change="changeTaskStatus(task, $event)" />
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
import SmartDatePicker from "../../../components/SmartDatePicker.vue";
import { computed, onMounted, ref } from 'vue';
const formatRequestDate = value => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const requests = ref([]), requestsLoading = ref(true), requestsError = ref(false);
async function loadRequests() {
  requestsLoading.value = true;
  requestsError.value = false;
  try {
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    const { data } = await axiosInstance.get('/reviews', { params: { module: 'projects' } });
    requests.value = data.data.filter(request => request.kind === 'PROJECT_CREATE' && request.makerId === userId);
  } catch {
    requestsError.value = true;
  } finally {
    requestsLoading.value = false;
  }
}
onMounted(() => { if (liveMode) loadRequests(); });
import axiosInstance from '../../../api/axiosConfig';
import SmartSelect from '../../../components/SmartSelect.vue';
import PremiumComposeDialog from '../../../components/PremiumComposeDialog.vue';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const composeOpen=ref(false);
const loading = ref(false), busy = ref(false), error = ref(''), success = ref('');
const projects = ref([]), selectedId = ref(sessionStorage.getItem('pmo-selected-project') || null), tasks = ref([]), showCreate=ref(false);
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
    if(selectedId.value)sessionStorage.setItem('pmo-selected-project',selectedId.value);
    else sessionStorage.removeItem('pmo-selected-project');
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
  sessionStorage.setItem('pmo-selected-project',id);
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
    showCreate.value = false;
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
    composeOpen.value=false;
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
.requests{padding:20px;margin-block:20px;min-inline-size:0}
.requests li{display:flex;gap:8px 16px;flex-wrap:wrap;overflow-wrap:anywhere}
.requests a{color:var(--pmo-accent)}
.module-shortcuts{display:flex;gap:9px;flex-wrap:wrap}
.workspace {background:var(--pmo-accent-soft);min-height:100vh;padding:34px;color:var(--pmo-text);}
.workspace-header {display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:26px;}
.eyebrow {font-weight:800;letter-spacing:.1em;color:var(--pmo-accent-ink);font-size:11px;}
.workspace-header h1 {font-size:30px;font-weight:750;margin:5px 0;}
.workspace-header p:not(.eyebrow) {color:#71809a;font-size:14px;}
.report-link {color:var(--pmo-accent-ink);font-weight:700;text-decoration:none;background:white;padding:12px 18px;border-radius:10px;white-space:nowrap;}
.notice {background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);padding:15px 20px;border-radius:10px;margin:0 0 22px;font-size:13px;}
.notice.error {background:#ffebee;color:#ad2f4b;}
.notice.success {background:#e6f9ee;color:#166b4d;}
.workspace-layout {display:block;margin-top:20px;}
.project-overview{display:block}.project-choices{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px!important;margin-top:20px!important}
.project-choices .project-tile{min-width:0;display:grid;align-content:start;gap:6px}.project-choices .project-tile button{min-height:136px;justify-content:space-between;gap:12px!important;padding:19px!important;box-shadow:0 5px 18px color-mix(in srgb, var(--pmo-accent) 4%, transparent)}
.project-choices button.selected{box-shadow:0 0 0 2px color-mix(in srgb, var(--pmo-accent) 33%, transparent)}
.project-workspace-link{font-size:12px;font-weight:750;text-decoration:none;color:var(--pmo-accent-ink);background:var(--pmo-accent-soft);padding:10px 13px;border-radius:9px;display:inline-block;margin:9px 0}.project-list .project-workspace-link{margin:0;align-self:start}.create-project-action{display:inline-block;text-decoration:none}
.project-list{width:100%}.create-project-action,.empty-project-landing button{border:0;border-radius:10px;background:var(--pmo-accent);color:var(--pmo-on-accent);padding:12px 18px;font-weight:750;cursor:pointer}
.create-form{max-width:520px;background:var(--pmo-accent-soft);padding:20px;border-radius:14px}
.empty-project-landing{text-align:center;padding:48px 18px;color:#61728b}.empty-project-landing .material-symbols-outlined{font-size:44px;color:#98a9c4}.empty-project-landing h3{font-size:20px;color:var(--pmo-text);margin:8px 0}.empty-project-landing p{font-size:13px}
@media(max-width:1200px){.project-choices{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:620px){.project-choices{grid-template-columns:1fr!important}}
.workspace-card {background:#fff;border-radius:18px;padding:25px;border:1px solid var(--pmo-border);}
.section-heading {display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;}
.section-heading h2 {font-size:20px;font-weight:750;margin:0;}
.section-heading span,.task-header span {color:#75839a;font-size:12px;}
.create-form,.task-create {display:flex;flex-direction:column;gap:9px;}
label {color:#566881;font-size:12px;font-weight:700;}
input,select {border:1px solid var(--pmo-border);border-radius:9px;padding:11px 13px;background:#fff;color:var(--pmo-text);min-width:0;font:inherit;font-size:13px;}
input:focus-visible,select:focus-visible,button:focus-visible {outline:3px solid var(--pmo-accent-ink);outline-offset:2px;}
form button {margin-top:9px;background:var(--pmo-accent);color:var(--pmo-on-accent);border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;}
button:disabled {opacity:.5;cursor:not-allowed;}
.project-choices {display:flex;flex-direction:column;gap:9px;margin-top:22px;}
.project-choices button {display:flex;flex-direction:column;align-items:start;text-align:left;gap:5px;padding:13px 15px;border:1px solid var(--pmo-border);border-radius:11px;background:#fff;cursor:pointer;}
.project-choices button.selected {border-color:var(--pmo-accent);background:var(--pmo-accent-soft);}
.project-choices strong {font-size:13px;color:var(--pmo-text);}
.project-choices small {font-size:12px;color:#72829a;}
.project-status {color:var(--pmo-accent-ink);font-weight:700;font-size:11px;}
.loading,.empty-project {color:#78879b;padding:26px 0;font-size:14px;}
.detail-desc {color:#738198;font-size:14px;margin-top:-9px;}
.detail-settings {display:flex;gap:12px;align-items:end;padding:20px 0;border-bottom:1px solid #ecf0f4;}
.detail-settings > div {display:flex;flex-direction:column;gap:8px;flex:1;}
.detail-settings button {white-space:nowrap;}
.task-header {display:flex;justify-content:space-between;align-items:center;margin-top:26px;}
.task-header h3 {font-size:17px;font-weight:750;}
.progress-track {height:8px;background:var(--pmo-accent-soft);border-radius:10px;overflow:hidden;margin:12px 0 22px;}
.progress-fill {height:100%;background:var(--pmo-accent);transition:width .2s;}
.task-create {padding:18px;border:1px solid var(--pmo-border);border-radius:12px;background:var(--pmo-accent-soft);}
.tasks {padding:0;margin:20px 0 0;list-style:none;}
.tasks li {padding:14px 0;border-bottom:1px solid var(--pmo-border);display:flex;align-items:center;gap:12px;}
.task-details {flex:1;min-width:0;}
.task-details strong {display:block;font-size:13px;word-break:break-word;}
.task-details small {display:block;color:#77859b;font-size:12px;margin-top:6px;}
.task-details{flex:1 1 220px;min-width:140px}.tasks li>.smart-select{width:160px;flex:0 0 160px}.tasks select {max-width:146px;}
.tasks li.task-empty {color:#77859b;font-size:13px;}
@media(max-width:1000px){.workspace-layout{grid-template-columns:1fr;}}
@media(max-width:600px){.workspace{padding:16px}.workspace-header{flex-direction:column;align-items:start}.workspace-card{padding:18px}.detail-settings{flex-direction:column;align-items:stretch}.tasks li{flex-wrap:wrap}.tasks li>.smart-select{width:100%;flex:1 1 100%}.tasks select{max-width:none;}}
</style>
