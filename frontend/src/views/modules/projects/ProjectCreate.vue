<template>
  <main class="create-page">
    <header class="page-top"><div><h1>Create a project</h1><p>Set up the project charter, delivery approach, and initial schedule. An independent checker approves the project before it becomes active.</p></div><router-link class="pmo-control quiet" to="/projects">Back to projects</router-link></header>
    <p v-if="revisionLoading" role="status">Loading the returned charter…</p>
    <p v-if="original" class="notice">Revising a returned request. <strong v-if="original.comment">Checker: {{ original.comment }}</strong></p>
    <p v-if="error" class="alert error" role="alert">{{error}}</p>
    <section v-if="success" class="success-card" role="status"><span class="material-symbols-outlined">task_alt</span><h2>Project submitted for approval</h2><p>Your project charter is pending independent review. Once approved, its Project Workspace will appear among the project cards.</p><div class="actions"><router-link :to="{ name: 'ProjectApprovals', params: { requestId: submittedId } }">Track approval</router-link><router-link to="/projects">Back to projects</router-link></div></section>
    <form v-else id="project-charter-form" @submit.prevent="create" class="create-grid">
      <div class="main-fields">
        <section class="panel"><div class="section-heading"><span class="section-number">01</span><div><h2>Project information</h2><p>Define what success looks like and who the project serves.</p></div></div>
          <div class="field-grid"><label class="wide">Project name (required) <input v-model.trim="name" required minlength="2" maxlength="140" placeholder="e.g. Customer self-service portal" /></label><label>Client / business unit (optional) <input v-model.trim="client" maxlength="140" placeholder="Internal or external customer" /></label><label>Project reference (optional) <input v-model.trim="reference" maxlength="40" placeholder="Optional internal reference" /></label></div>
          <label class="stacked">Overview and outcome <textarea v-model.trim="description" rows="5" maxlength="1500" placeholder="Business objective, scope, key deliverables and success criteria" /></label>
        </section>
        <section class="panel"><div class="section-heading"><span class="section-number">02</span><div><h2 id="delivery-method">Delivery method</h2><p>Choose the default view for project work. Both approaches share one backlog.</p></div></div>
          <div class="method-grid" role="radiogroup" aria-labelledby="delivery-method">
            <label v-for="option in deliveryOptions" :key="option.value" class="method-card" :class="{picked:method===option.value}">
              <input type="radio" name="delivery-method" v-model="method" :value="option.value" :aria-label="option.label" />
              <strong>{{ option.label }}</strong><small>{{ option.description }}</small>
            </label>
          </div>
        </section>
        <section class="panel"><div class="section-heading"><span class="section-number">03</span><div><h2>Schedule & milestones</h2><p>Set indicative dates. You can refine your work items after approval.</p></div></div>
          <div class="field-grid"><label>Planned start <SmartDatePicker v-model="startDate" aria-label="Planned start date" /></label><label>Target completion <SmartDatePicker v-model="endDate" aria-label="Target completion date" :min="startDate" /></label></div>
        </section>
      </div>
      <aside class="summary"><div class="panel summary-panel"><h2>Charter summary</h2><div class="preview"><span>Project</span><strong>{{name||'Untitled project'}}</strong><span>Delivery</span><strong>{{method==='KANBAN'?'Kanban / Agile':'Waterfall / Phased'}}</strong><span>Schedule</span><strong>{{startDate||'TBD'}} — {{endDate||'TBD'}}</strong></div><p class="notice">A separate reviewer must approve this charter before the project becomes active.</p><div class="charter-actions">
        <router-link class="pmo-control quiet" to="/projects">Cancel</router-link>
        <button type="submit" class="pmo-control primary" :disabled="busy||name.length<2||!liveMode||revisionLoading||Boolean(route.query.revise && !original)">{{busy?'Submitting…':'Submit project for approval'}}</button>
      </div></div></aside>
    </form>
  </main>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import axios from '../../../api/axiosConfig';
import SmartDatePicker from '../../../components/SmartDatePicker.vue';
const liveMode=import.meta.env.VITE_USE_LIVE_API==='true';
const name=ref(''),client=ref(''),reference=ref(''),description=ref(''),method=ref('KANBAN'),startDate=ref(''),endDate=ref(''),busy=ref(false),error=ref(''),success=ref(false);
const route = useRoute();
const submittedId = ref('');
const original = ref(null), revisionLoading = ref(false);
onMounted(async () => {
  const id = route.query.revise;
  if (typeof id !== 'string' || !id) return;
  revisionLoading.value = true;
  try {
    const { data } = await axios.get('/reviews', { params:{module:'projects',id} });
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    const request = data.data.find(item => item.kind === 'PROJECT_CREATE' && item.status === 'RETURNED' && item.makerId === userId);
    if (!request?.proposed?.values) throw new Error('The returned charter could not be loaded.');
    original.value = request;
    const values = request.proposed.values;
    name.value = values.name || ''; client.value = values.client || ''; description.value = values.description || '';
    const referenceLine = description.value.match(/^Reference: ([^\n]+)(?:\n|$)/);
    if (referenceLine) {
      reference.value = referenceLine[1];
      description.value = description.value.slice(referenceLine[0].length);
    }
    method.value = values.deliveryMethod || 'KANBAN';
    startDate.value = values.startDate?.slice(0,10) || '';
    endDate.value = values.targetEndDate?.slice(0,10) || '';
  } catch (cause) { error.value = cause.message; }
  finally { revisionLoading.value = false; }
});
const deliveryOptions = [
  { value: 'KANBAN', label: 'Agile · Kanban', description: 'Manage work across status columns.' },
  { value: 'WATERFALL', label: 'Waterfall · Phases', description: 'Organize deliverables into phases and milestones.' }
];
onBeforeRouteLeave(() => {
  if (busy.value) return false;
  if (success.value || ![name.value, client.value, reference.value, description.value, startDate.value, endDate.value, method.value !== 'KANBAN'].some(Boolean)) return true;
  return window.confirm('Discard your unsaved project draft?');
});
async function create(){if(revisionLoading.value || (route.query.revise && !original.value))return;error.value='';if(endDate.value&&startDate.value&&endDate.value<startDate.value){error.value='Target completion must be after the start date.';return;}busy.value=true;
  try{const response=await axios.post('/reviews/operations',{kind:'PROJECT_CREATE',...(original.value ? {revisesRequestId:original.value.id} : {}),summary:'Create project '+name.value,values:{name:name.value,client:client.value,description:[reference.value?'Reference: '+reference.value:'',description.value].filter(Boolean).join('\n'),deliveryMethod:method.value,...(startDate.value?{startDate:new Date(startDate.value+'T12:00:00').toISOString()}:{}),...(endDate.value?{targetEndDate:new Date(endDate.value+'T12:00:00').toISOString()}: {})}});submittedId.value=response.data.data?.id || '';success.value=true;}catch(e){const m=e.response?.data?.message;error.value=Array.isArray(m)?m.join(', '):m||e.message;}finally{busy.value=false;}}
</script>
<style scoped>
.summary-panel .cancel-project{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--pmo-border);border-radius:10px;font-size:14px;font-weight:600}
.method-card input[type=radio]{width:18px;height:18px;accent-color:var(--pmo-accent)}
.method-card:focus-within{outline:2px solid var(--pmo-accent);outline-offset:2px}
.create-page .panel .section-heading p{font-size:13px;line-height:20px}
.create-page{padding:30px clamp(16px,4vw,46px);background:var(--pmo-accent-soft);min-height:100vh;color:var(--pmo-text)}.page-top{display:flex;justify-content:space-between;gap:20px;align-items:center}.eyebrow{font-size:10px;letter-spacing:.13em;font-weight:800;color:var(--pmo-accent-ink)}.page-top h1{font-size:30px;margin:9px 0}.page-top p:not(.eyebrow){font-size:13px;color:#64748b;max-width:660px;line-height:1.7}.back-link{text-decoration:none;background:white;padding:12px 16px;border-radius:10px;color:var(--pmo-accent-ink);font-size:12px;font-weight:750}.step-row{display:flex;flex-wrap:wrap;gap:15px;margin:26px 0;color:#526888;font-size:11px;font-weight:800}.step-row span{padding:9px 13px;border-radius:20px;background:var(--pmo-accent-soft)}.create-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.main-fields{display:grid;gap:20px}.panel{background:#fff;border:1px solid var(--pmo-border);border-radius:16px;padding:25px}.section-heading{display:flex;gap:14px;align-items:center;margin-bottom:24px}.section-number{width:38px;height:38px;display:grid;place-items:center;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);border-radius:12px;font-weight:800;font-size:13px}.section-heading h2{font-size:19px;margin:0 0 5px}.section-heading p{font-size:12px;color:#6e7e94;margin:0}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.wide{grid-column:1/-1}label{display:grid;gap:8px;font-size:12px;font-weight:750;color:var(--pmo-text)}.stacked{margin-top:20px}input,textarea{border:1px solid var(--pmo-border);background:var(--pmo-accent-soft);border-radius:10px;padding:13px;color:var(--pmo-text);font:inherit;font-size:13px;width:100%}.method-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.method-card{display:grid;gap:12px;text-align:left;border:1px solid var(--pmo-border);border-radius:14px;padding:19px;background:var(--pmo-accent-soft);color:var(--pmo-text);cursor:pointer}.method-card.picked{border-color:var(--pmo-accent);box-shadow:0 0 0 2px color-mix(in srgb, var(--pmo-accent) 18%, transparent);background:var(--pmo-accent-soft)}.method-card .material-symbols-outlined{font-size:25px;color:var(--pmo-accent-ink)}.method-card small{color:#6f8098;line-height:1.6}.summary{position:sticky;top:92px}.summary-panel{display:grid;gap:16px}.summary-panel h2{margin:0;font-size:20px}.preview{display:grid;gap:7px;overflow-wrap:anywhere}.preview span{font-size:10px;color:#8190a5;margin-top:9px}.preview strong{font-size:13px}.notice{background:var(--pmo-accent-soft);color:#546b90;padding:14px;border-radius:10px;font-size:12px;line-height:1.6}.summary-panel>button,.success-card a{border:0;border-radius:10px;background:var(--pmo-accent);padding:13px;color:var(--pmo-on-accent);font-weight:750;cursor:pointer;font-size:12px}.summary-panel>button:disabled{opacity:.55}.summary-panel>a{font-size:12px;text-align:center;color:#5b709a;text-decoration:none}.error{color:#a72649;background:#ffe8ee;padding:14px;border-radius:10px}.success-card{max-width:650px;padding:35px;border:1px solid #cfe6da;background:#fff;border-radius:16px}.success-card>span{color:#16805b;font-size:35px}.success-card p{color:#6a7a91}.actions{display:flex;gap:12px}.actions a{text-decoration:none}
@media(max-width:950px){.create-grid{grid-template-columns:1fr}.summary{position:static}}@media(max-width:580px){.field-grid,.method-grid{grid-template-columns:1fr}.page-top{flex-direction:column;align-items:start}.panel{padding:18px}}
</style>