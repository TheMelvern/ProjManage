<template>
  <main class="raid-workspace">
    <header class="raid-header">
      <div>
        <p class="eyebrow">PROJECT GOVERNANCE</p>
        <h1>RAID Register</h1>
        <p>Track risks, issues, decisions and action items across your project portfolio.</p>
      </div>
      <div class="module-shortcuts"><router-link to="/raid/detail" class="nav-link">View details</router-link><router-link to="/workspace" class="nav-link">Delivery workspace</router-link></div>
    </header>
    <p v-if="!liveMode" role="status" class="notice">
      This workspace requires local API mode. Set VITE_USE_LIVE_API=true and sign in.
    </p>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <p v-if="message" role="status" class="notice success">{{ message }}</p>
    <div class="selector">
      <label for="raid-project">Project</label>
      <SmartSelect id="raid-project" v-model="selectedProjectId" aria-label="Project" @change="loadRegister" :disabled="!liveMode || loading" :options="[{value:'',label:'Select a project'},...projects.map(project=>({value:project.id,label:project.name}))]" />
      <button type="button" @click="loadRegister" :disabled="!selectedProjectId || loading">Refresh</button>
    </div>
    <section v-if="selectedProjectId" class="register">
      <div class="tabs" role="group" aria-label="RAID category">
        <button v-for="tab in tabs" :key="tab.key" type="button"
          :class="{ active: activeTab === tab.key }" :aria-pressed="activeTab === tab.key"
          @click="activeTab = tab.key">{{ tab.label }} <span>{{ register[tab.key].length }}</span></button>
      </div>
      <div class="premium-add-bar"><div><strong>{{ activeTab.charAt(0).toUpperCase()+activeTab.slice(1) }} register</strong><p>Capture a new entry for independent review.</p></div><button type="button" class="premium-add-trigger" @click="composeOpen=true"><span class="material-symbols-outlined" aria-hidden="true">add_circle</span> Add {{ activeTab.slice(0,-1) }}</button></div>
      <PremiumComposeDialog :open="composeOpen" :title="'New '+activeTab.slice(0,-1)" eyebrow="GOVERNANCE / NEW ENTRY" description="Document a clear description before routing this item for approval." :error="error" @close="composeOpen=false">
      <form class="add-form" @submit.prevent="addEntry">
        <label for="raid-title">New {{ activeTab.slice(0,-1) }} title</label>
        <input id="raid-title" v-model.trim="title" maxlength="200" minlength="2" required
          :disabled="busy" placeholder="Describe the item to track" />
        <template v-if="activeTab === 'risks' || activeTab === 'issues'">
          <label for="raid-severity">Severity</label>
          <SmartSelect id="raid-severity" v-model="severity" aria-label="Severity" :disabled="busy" :options="['LOW','MEDIUM','HIGH','CRITICAL'].map(v=>({value:v,label:v}))" />
        </template>
        <button type="submit" :disabled="busy || title.length < 2">Submit item</button>
      </form>
      </PremiumComposeDialog>
      <div class="entries">
        <article v-for="item in register[activeTab]" :key="item.id" class="entry">
          <div>
            <strong>{{ item.title }}</strong>
            <p v-if="item.description">{{ item.description }}</p>
            <small>{{ item.severity || 'Recorded' }} · {{ formatDate(item.createdAt || item.decidedAt) }}</small>
          </div>
          <label v-if="activeTab !== 'decisions'" :for="'status-' + item.id">Status</label>
          <SmartSelect v-if="activeTab !== 'decisions'" :id="'status-' + item.id" :model-value="item.status" aria-label="RAID item status" @change="changeStatus(item, $event)" :disabled="busy" :options="['OPEN','IN_PROGRESS','CLOSED'].map(v=>({value:v,label:v}))" />
        </article>
        <p v-if="!register[activeTab].length" class="empty">No {{ activeTab }} recorded for this project.</p>
      </div>
    </section>
    <p v-else-if="liveMode && !loading" class="empty">Create or select a project in the Delivery Workspace.</p>
  </main>
</template>

<script setup>
import SmartSelect from '../../../components/SmartSelect.vue';
import PremiumComposeDialog from '../../../components/PremiumComposeDialog.vue';
import { onMounted, ref } from 'vue';
import axiosInstance from '../../../api/axiosConfig';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const tabs = [
  { key: 'risks', label: 'Risks' }, { key: 'issues', label: 'Issues' },
  { key: 'decisions', label: 'Decisions' }, { key: 'actions', label: 'Actions' }
];
const composeOpen = ref(false);
const activeTab = ref('risks');
const selectedProjectId = ref('');
const projects = ref([]);
const register = ref({ risks: [], issues: [], decisions: [], actions: [] });
const title = ref('');
const severity = ref('MEDIUM');
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const message = ref('');
const formatDate = value => value ? new Date(value).toLocaleDateString() : '—';

function reportError(cause) {
  const message = cause?.response?.data?.message;
  error.value = Array.isArray(message) ? message.join(', ') : message || cause?.message || 'Operation failed';
}
async function loadProjects() {
  if (!liveMode) return;
  loading.value = true;
  try {
    const response = await axiosInstance.get('/projects');
    projects.value = response.data.data;
    selectedProjectId.value = projects.value[0]?.id || '';
    await loadRegister();
  } catch (cause) { reportError(cause); }
  finally { loading.value = false; }
}
async function loadRegister() {
  error.value = '';
  register.value = { risks: [], issues: [], decisions: [], actions: [] };
  if (!selectedProjectId.value) return;
  try {
    const response = await axiosInstance.get('/projects/' + encodeURIComponent(selectedProjectId.value) + '/raid');
    register.value = response.data.data;
  } catch (cause) { reportError(cause); }
}
async function addEntry() {
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    const payload = { title: title.value };
    if (activeTab.value === 'risks' || activeTab.value === 'issues') payload.severity = severity.value;
    const kind = { risks: 'RISK_CREATE', issues: 'ISSUE_CREATE', decisions: 'DECISION_CREATE', actions: 'ACTION_CREATE' }[activeTab.value];
    await axiosInstance.post('/reviews/operations', {
      kind, projectId: selectedProjectId.value, summary: 'Create ' + activeTab.value.slice(0, -1) + ' ' + title.value,
      values: payload
    });
    title.value = '';composeOpen.value=false;
    message.value = 'RAID item submitted for independent approval.';
  } catch (cause) { reportError(cause); }
  finally { busy.value = false; }
}
async function changeStatus(item, status) {
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    const kind = { risks: 'RISK_UPDATE', issues: 'ISSUE_UPDATE', actions: 'ACTION_UPDATE' }[activeTab.value];
    await axiosInstance.post('/reviews/operations', {
      kind, projectId: selectedProjectId.value, targetId: item.id,
      summary: 'Change ' + activeTab.value + ' status for ' + item.title, values: { status }
    });
    message.value = 'RAID status change submitted for independent approval.';
  } catch (cause) { reportError(cause); }
  finally { busy.value = false; }
}
onMounted(loadProjects);
</script>

<style scoped>
.module-shortcuts{display:flex;gap:9px;flex-wrap:wrap}
.raid-workspace{min-height:100vh;background:#f5f7fb;padding:34px;color:#21334b}
.raid-header{display:flex;gap:24px;justify-content:space-between;align-items:center;margin-bottom:26px}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.1em;color:#4a66ad}
.raid-header h1{font-size:30px;font-weight:750;margin:6px 0}
.raid-header p:not(.eyebrow){color:#71829b;font-size:14px}
.nav-link{background:white;border-radius:10px;padding:13px;color:#3158bd;font-size:13px;font-weight:700}
.notice{padding:17px;background:#e9f1ff;border-radius:12px;color:#395ba2;margin-bottom:20px}
.notice.error{background:#fff0f1;color:#b6324a}.notice.success{background:#e9f9ef;color:#196844}
.selector{display:flex;gap:16px;align-items:center;background:white;border-radius:16px;padding:22px;margin-bottom:20px}
.selector label,.add-form label,.entry label{font-size:12px;color:#61738a;font-weight:700}
select,input{padding:11px;border:1px solid #dce3ef;background:white;border-radius:9px;color:#263852;min-width:0}
.selector select{flex:1}.selector button,.add-form button{padding:12px 19px;border:0;background:#315ac3;color:#fff;font-weight:700;border-radius:9px;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
.register{background:white;border-radius:18px;padding:24px}
.tabs{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:25px;border-bottom:1px solid #e8edf5;padding-bottom:18px}
.tabs button{border:1px solid #e2e8f0;background:white;color:#687991;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer}
.tabs button.active{background:#eaf0ff;border-color:#b3c7fb;color:#315ac3}
.tabs span{font-size:11px;margin-left:5px;opacity:.65}
.add-form{display:flex;gap:11px;align-items:center;flex-wrap:wrap;margin-bottom:26px}
.add-form input{flex:1;min-width:200px}
.entry{border-top:1px solid #edf1f6;padding:20px 0;display:flex;align-items:center;gap:16px}
.entry>div{flex:1}.entry strong{font-size:15px}
.entry p{font-size:13px;color:#718096}.entry small{display:block;margin-top:8px;color:#8190a5;font-size:12px}
.empty{padding:40px 12px;text-align:center;color:#8290a4;font-size:14px}
@media(max-width:700px){.raid-workspace{padding:16px}.raid-header,.selector,.entry{flex-direction:column;align-items:stretch}.register{padding:15px}.selector select{width:100%}}
</style>
