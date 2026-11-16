<template>
  <main class="audit-screen">
    <header><p class="eyebrow">ADMINISTRATION / SECURITY</p><h1>Audit & Security</h1><p>Review approval decisions and administrative changes in your organization.</p></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section class="card">
      <div class="head"><div><h2>Administrative audit history</h2><p>Audit events are read-only; each event identifies the actor, entity and timestamp.</p></div>
        <button @click="load">Refresh</button></div>
      <div class="controls">
        <label>Action category <SmartSelect v-model="filter" aria-label="Audit action filter" :options="[{value:'',label:'All actions'},...actions.map(x=>({value:x,label:x}))]" /></label>
        <label>Search actor or entity <input v-model.trim="query" placeholder="Find an event"/></label>
      </div>
      <p v-if="loading">Loading audit records…</p>
      <div v-else class="scroll"><table><thead><tr><th>Timestamp</th><th>Actor</th><th>Event</th><th>Entity</th><th>Reference</th></tr></thead>
        <tbody><tr v-for="record in visible" :key="record.id">
          <td>{{ stamp(record.createdAt) }}</td>
          <td><span class="identity"><span class="badge">{{ initials(record.actorName) }}</span>{{ record.actorName }}</span></td>
          <td><span class="action">{{ record.action }}</span></td><td>{{ record.entityType }}</td><td class="mono">{{ record.entityId.slice(0,12) }}…</td>
        </tr><tr v-if="!visible.length"><td colspan="5" class="empty">No matching audit events.</td></tr></tbody>
      </table></div>
      <p class="disclaimer">Access restricted to administrators. Exporting audit records should follow organizational retention and privacy rules.</p>
    </section>
  </main>
</template>
<script setup>
import SmartSelect from '../../../components/SmartSelect.vue';
import { computed,onMounted,ref } from 'vue';
import axios from '../../../api/axiosConfig';
const rows=ref([]),error=ref(''),loading=ref(false),filter=ref(''),query=ref('');
const actions=computed(()=>[...new Set(rows.value.map(x=>x.action))].sort());
const visible=computed(()=>rows.value.filter(x=>(!filter.value||x.action===filter.value)&&
  [x.actorName,x.action,x.entityType,x.entityId].join(' ').toLowerCase().includes(query.value.toLowerCase())));
const initials=n=>String(n||'?').split(/\s+/).slice(0,2).map(x=>x[0].toUpperCase()).join('');
const stamp=d=>new Date(d).toLocaleString();
async function load(){loading.value=true;error.value='';try{
  rows.value=(await axios.get('/admin/audit')).data.data;
}catch(e){const m=e.response?.data?.message;error.value=Array.isArray(m)?m.join(', '):m||e.message;}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.audit-screen{padding:32px;background:#f4f7fb;color:#18253c;min-height:100vh;display:grid;align-content:start;gap:20px}.eyebrow{font-size:11px;color:#355ad3;font-weight:800;letter-spacing:.1em}header h1{font-size:30px;margin:6px 0}header p:not(.eyebrow),.card p{color:#65748b;font-size:13px}.card{background:#fff;border:1px solid #e4eaf3;border-radius:16px;padding:24px;min-width:0}.card h2{font-size:18px;margin:0 0 8px}.head{display:flex;align-items:center;justify-content:space-between;gap:16px}.controls{display:flex;gap:15px;flex-wrap:wrap;margin:18px 0}label{display:grid;gap:7px;font-size:12px;font-weight:750}select,input{border:1px solid #d7e0ed;border-radius:9px;padding:11px;background:#f8faff;color:#233650;font-size:12px}button{border:0;border-radius:9px;background:#355ad3;color:#fff;font-weight:750;padding:11px 16px;cursor:pointer}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;min-width:700px}th{background:#f0f4fa;color:#617087;font-size:11px;padding:13px}td{font-size:12px;border-bottom:1px solid #e8eef5;padding:13px}.identity{display:flex;align-items:center;gap:9px}.badge{width:30px;height:30px;border-radius:50%;background:#e5edfc;color:#315ac4;font-size:10px;font-weight:800;display:grid;place-items:center}.mono{font-family:ui-monospace,monospace}.action{background:#eaf1fd;color:#315ac4;border-radius:16px;padding:6px 10px;font-size:10px;font-weight:750}.empty{text-align:center;padding:25px}.disclaimer{margin-top:19px}.links{display:flex;flex-wrap:wrap;gap:12px;margin-top:17px}.links a{color:#315ac4;background:#eef3fd;text-decoration:none;font-size:12px;font-weight:750;padding:11px 14px;border-radius:9px}.error{padding:12px;border-radius:9px;background:#ffe8ed;color:#a62f49}
@media(max-width:650px){.audit-screen{padding:17px}.head{align-items:flex-start;flex-direction:column}}
</style>
