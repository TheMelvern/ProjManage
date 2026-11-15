<template>
  <main class="detail-screen">
    <header class="detail-header">
      <div><p class="eyebrow">PMO OPERATIONS / {{ area.toUpperCase() }}</p>
        <h1>{{ heading }}</h1><p>{{ intro }}</p></div>
      <router-link class="link" :to="backLink">Back to {{ area }}</router-link>
    </header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <p v-if="notice" class="message" role="status">{{ notice }}</p>
    <section class="card project-select">
      <label for="detail-project">Project</label>
      <select id="detail-project" v-model="projectId">
        <option value="">Select project</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <router-link to="/approvals" class="link">Open approval queue</router-link>
    </section>
    <p v-if="loading">Loading project records…</p>
    <template v-else-if="projectId && project">
      <section v-if="area === 'projects'" class="card">
        <h2>Project details & delivery configuration</h2><p>Approved changes are applied only after a second authorized reviewer confirms them.</p>
        <form @submit.prevent="saveProject">
          <div class="form-grid">
            <label>Project name<input v-model.trim="projectDraft.name" minlength="2" maxlength="140" required /></label>
            <label>Client<input v-model.trim="projectDraft.client" maxlength="140" /></label>
            <label>Status<select v-model="projectDraft.status"><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select></label>
            <label>Health<select v-model="projectDraft.health"><option v-for="s in healthStates" :key="s" :value="s">{{ s }}</option></select></label>
          </div>
          <label>Description<textarea v-model.trim="projectDraft.description" rows="3" maxlength="1500"></textarea></label>
          <button type="submit" :disabled="busy">Submit edits for check</button>
        </form>
        <h2>Delivery tasks</h2>
        <div class="rows"><div v-for="task in tasks" :key="task.id" class="record">
          <div class="record-copy"><strong>{{ task.title }}</strong><small>{{ task.dueDate ? 'Due '+formatDate(task.dueDate) : 'No due date' }}</small></div>
          <span class="pill">{{ task.status }}</span>
          <button class="secondary" :disabled="busy" @click="proposeTask(task,task.status==='DONE'?'IN_PROGRESS':'DONE')">
            {{ task.status==='DONE'?'Reopen':'Mark done' }} for check</button>
        </div><p v-if="!tasks.length">No approved tasks yet.</p></div>
      </section>
      <section v-if="area === 'raid'" class="card">
        <h2>RAID item detail & resolution</h2><p>Update risk, issue or action records through an independent checker.</p>
        <div class="tabs">
          <button v-for="tab in raidTabs" :key="tab" :class="{active:raidTab===tab}" @click="raidTab=tab">{{ tab }} ({{ register[tab]?.length||0 }})</button>
        </div>
        <div v-if="register[raidTab]?.length" class="rows">
          <div v-for="item in register[raidTab]" :key="item.id" class="record">
            <div class="record-copy"><strong>{{ item.title }}</strong>
              <small>{{ item.severity||item.status||'Recorded' }} · {{ item.ownerName||'No owner' }}</small></div>
            <button class="secondary" @click="selectItem(item)">Review details</button>
          </div>
        </div><p v-else>No approved records in this register.</p>
        <form v-if="selectedItem && raidTab!=='decisions'" class="raid-editor" @submit.prevent="saveRaid">
          <h3>Edit {{ raidTab.slice(0,-1) }} — {{ selectedItem.title }}</h3>
          <label>Title<input v-model.trim="raidDraft.title" required minlength="2" /></label>
          <div class="form-grid"><label>Status<select v-model="raidDraft.status"><option>OPEN</option><option>IN_PROGRESS</option><option>CLOSED</option></select></label>
            <label v-if="raidTab==='risks'||raidTab==='issues'">Severity<select v-model="raidDraft.severity"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label></div>
          <label>Owner<input v-model.trim="raidDraft.ownerName" placeholder="Responsible person"/></label>
          <label v-if="raidTab==='risks'">Mitigation<textarea v-model.trim="raidDraft.mitigation" rows="3"/></label>
          <label v-if="raidTab==='issues'">Resolution<textarea v-model.trim="raidDraft.resolution" rows="3"/></label>
          <button type="submit" :disabled="busy">Submit amendment for check</button>
        </form>
      </section>
      <section v-if="area === 'timesheets'" class="card">
        <h2>Approved time entries</h2><p>Only independently approved hours contribute to the project effort log.</p>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Hours</th><th>Description</th><th>User</th></tr></thead>
          <tbody><tr v-for="item in entries" :key="item.id"><td>{{ formatDate(item.workDate) }}</td><td>{{ Number(item.hours).toFixed(2) }}</td><td>{{ item.description||'—' }}</td><td>{{ item.userId.slice(0,8) }}</td></tr>
          <tr v-if="!entries.length"><td colspan="4">No approved entries.</td></tr></tbody></table></div>
        <router-link class="link" to="/timesheets">Log additional time</router-link>
      </section>
      <section v-if="area === 'reports'" class="card">
        <h2>Project executive detail</h2><p>Consolidated from approved project and task records.</p>
        <div v-if="projectReport" class="metric-grid">
          <article><small>Project health</small><strong>{{ projectReport.health }}</strong></article>
          <article><small>Delivery status</small><strong>{{ projectReport.status }}</strong></article>
          <article><small>Task completion</small><strong>{{ projectReport.progressPercent }}%</strong></article>
          <article><small>Overdue tasks</small><strong>{{ projectReport.taskCounts.overdue }}</strong></article>
        </div>
        <h3>Overdue deliverables</h3>
        <div v-if="projectReport?.overdueTasks?.length" class="rows">
          <div v-for="task in projectReport.overdueTasks" :key="task.id" class="record">
            <strong>{{ task.title }}</strong><small>Due {{ formatDate(task.dueDate) }}</small>
          </div>
        </div><p v-else>No overdue tasks.</p>
        <router-link class="link" to="/reports">Approved executive publications</router-link>
      </section>
    </template>
    <section v-else-if="!loading" class="card">Select a project to view its details and related records.</section>
    <section class="card"><h2>Related workflows</h2><div class="links">
      <router-link to="/projects">Projects</router-link><router-link to="/raid">RAID</router-link>
      <router-link to="/timesheets">Timesheets</router-link><router-link to="/reports">Reports</router-link>
      <router-link to="/approvals">Approval Center</router-link></div></section>
  </main>
</template>
<script setup>
import {computed,ref,onMounted,watch} from 'vue';
import {useRoute} from 'vue-router';
import axios from '../../../api/axiosConfig';
const route=useRoute();
const area=computed(()=>route.path.split('/')[1]||'projects');
const headings={projects:'Project Delivery Details',raid:'RAID Register Details',timesheets:'Project Timesheet History',reports:'Executive Project Report'};
const heading=computed(()=>headings[area.value]||'Project Detail');
const intro=computed(()=>({projects:'Project information, delivery status and task lifecycle.',raid:'Review risk, issue, decision and action details.',timesheets:'Approved project work effort and history.',reports:'Project-level health, progress and overdue delivery.'})[area.value]||'Project details');
const backLink=computed(()=>area.value==='projects'?'/workspace':'/'+area.value);
const projects=ref([]),projectId=ref(route.query.projectId||''),project=ref(null),tasks=ref([]),
 register=ref({risks:[],issues:[],decisions:[],actions:[]}),entries=ref([]),projectReport=ref(null);
const raidTabs=['risks','issues','decisions','actions'],raidTab=ref('risks'),selectedItem=ref(null),raidDraft=ref({});
const projectDraft=ref({}),loading=ref(false),busy=ref(false),notice=ref(''),error=ref('');
const statuses=['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'],healthStates=['UNKNOWN','GREEN','AMBER','RED'];
const formatDate=v=>new Date(v).toLocaleDateString();
const msg=e=>{const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Unable to load records';};
async function loadProjects(){try{
 projects.value=(await axios.get('/projects')).data.data;
 if(!projectId.value&&projects.value.length)projectId.value=projects.value[0].id;
}catch(e){error.value=msg(e);}}
async function loadDetails(){project.value=null;tasks.value=[];entries.value=[];selectedItem.value=null;projectReport.value=null;
 if(!projectId.value)return;loading.value=true;error.value='';try{
 const id=encodeURIComponent(projectId.value);
 project.value=(await axios.get('/projects/'+id)).data.data;
 projectDraft.value={name:project.value.name,client:project.value.client||'',
  description:project.value.description||'',status:project.value.status,health:project.value.health};
 if(area.value==='projects')tasks.value=(await axios.get('/projects/'+id+'/tasks')).data.data;
 if(area.value==='raid')register.value=(await axios.get('/projects/'+id+'/raid')).data.data;
 if(area.value==='timesheets')entries.value=(await axios.get('/projects/'+id+'/timesheets')).data.data;
 if(area.value==='reports')projectReport.value=(await axios.get('/reports/projects/'+id)).data.data;
}catch(e){error.value=msg(e);}finally{loading.value=false;}}
function selectItem(item){selectedItem.value=item;raidDraft.value={title:item.title,status:item.status||'OPEN',
  severity:item.severity||'MEDIUM',ownerName:item.ownerName||'',mitigation:item.mitigation||'',resolution:item.resolution||''};}
async function saveProject(){busy.value=true;error.value='';notice.value='';try{
 await axios.post('/reviews/projects',{projectId:projectId.value,...projectDraft.value,
  summary:'Approve project configuration changes for '+projectDraft.value.name});
 notice.value='Proposed project edits are awaiting an independent checker.';
}catch(e){error.value=msg(e);}finally{busy.value=false;}}
async function proposeTask(task,status){busy.value=true;error.value='';try{
 await axios.post('/reviews/operations',{kind:'TASK_UPDATE',projectId:projectId.value,targetId:task.id,
  summary:'Change task '+task.title+' to '+status,values:{status}});
 notice.value='Task status submitted to the checker queue.';
}catch(e){error.value=msg(e);}finally{busy.value=false;}}
async function saveRaid(){busy.value=true;error.value='';try{
 const kind={risks:'RISK_UPDATE',issues:'ISSUE_UPDATE',actions:'ACTION_UPDATE'}[raidTab.value];
 const values={title:raidDraft.value.title,status:raidDraft.value.status,ownerName:raidDraft.value.ownerName};
 if(raidTab.value==='risks'){values.severity=raidDraft.value.severity;values.mitigation=raidDraft.value.mitigation;}
 if(raidTab.value==='issues'){values.severity=raidDraft.value.severity;values.resolution=raidDraft.value.resolution;}
 await axios.post('/reviews/operations',{kind,projectId:projectId.value,targetId:selectedItem.value.id,
  values,summary:'Review '+raidTab.value+' item '+selectedItem.value.title});
 notice.value='RAID amendment submitted for independent approval.';
}catch(e){error.value=msg(e);}finally{busy.value=false;}}
watch(projectId,loadDetails);watch(area,loadDetails);
onMounted(async()=>{await loadProjects();await loadDetails();});
</script>
<style scoped>
.detail-screen{min-height:100vh;background:#f4f7fb;color:#18253c;padding:32px;display:grid;align-content:start;gap:20px}.detail-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.detail-header h1{font-size:29px;margin:6px 0}.detail-header p:not(.eyebrow),.card p{color:#64748b;font-size:13px}.eyebrow{font-weight:800;color:#355ad3;font-size:11px;letter-spacing:.09em}.card{background:#fff;border:1px solid #e5ebf3;border-radius:15px;padding:23px;min-width:0}.card h2{font-size:19px;margin:0 0 12px}.card h3{font-size:15px;margin:24px 0 13px}.project-select{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.project-select label,label{font-size:12px;font-weight:750;display:grid;gap:8px}.project-select select{min-width:240px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.card form{display:grid;gap:16px;margin:20px 0}input,select,textarea{font:inherit;font-size:13px;padding:12px 13px;border-radius:9px;border:1px solid #d7e1ef;background:#fbfcff;color:#273b59;width:100%}button{background:#355ad3;border:0;color:#fff;padding:11px 15px;border-radius:9px;font-size:12px;font-weight:750;cursor:pointer}button:disabled{opacity:.5}.secondary{background:#ecf2fd;color:#355ad3}.link,.links a{display:inline-block;text-decoration:none;background:#edf2fd;color:#355ad3;padding:11px 14px;border-radius:9px;font-size:12px;font-weight:750}.rows{display:grid;gap:9px}.record{display:flex;align-items:center;gap:12px;padding:15px;border-radius:9px;background:#f7f9fd}.record-copy{flex:1;min-width:0}.record strong{font-size:13px}.record small{display:block;color:#66758b;font-size:11px;margin-top:5px}.pill{background:#ebf1fb;color:#355ad3;padding:7px 10px;border-radius:16px;font-size:10px;font-weight:800}.tabs,.links{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}.tabs button{background:#edf1f8;color:#355ad3}.tabs .active{background:#355ad3;color:#fff}.raid-editor{border-top:1px solid #e4eaf2;padding-top:15px}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}.metric-grid article{background:#f5f8fc;border-radius:10px;padding:16px;display:grid;gap:10px}.metric-grid small{font-size:11px;color:#64748b}.metric-grid strong{font-size:20px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th{background:#f1f4f8;font-size:11px;color:#66758b;padding:12px}td{border-bottom:1px solid #e6ecf4;font-size:12px;padding:13px}.message{padding:13px;background:#e4f7ed;color:#187857;border-radius:9px}.message.error{background:#ffe9ed;color:#a3344e}
@media(max-width:850px){.metric-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.detail-screen{padding:16px}.detail-header{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr}.record{flex-wrap:wrap}.metric-grid{grid-template-columns:1fr 1fr}}
</style>
