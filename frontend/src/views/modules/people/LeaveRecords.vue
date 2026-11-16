<template>
 <main class="history-page">
  <header><p class="eyebrow">PEOPLE OPERATIONS / LEAVE HISTORY</p><h1>Leave Records & Policies</h1>
    <p>Review personal leave transactions, available entitlement and approval decisions.</p></header>
  <p v-if="error" class="alert error" role="alert">{{ error }}</p>
  <section class="stats" v-if="balances">
    <div><small>Annual entitlement</small><strong>{{ balances.entitlement.ANNUAL }}</strong><span>Days</span></div>
    <div><small>Annual used</small><strong>{{ balances.used.ANNUAL }}</strong><span>Approved weekdays</span></div>
    <div><small>Annual remaining</small><strong>{{ balances.remaining.ANNUAL }}</strong><span>Days available</span></div>
    <div><small>Medical leave remaining</small><strong>{{ balances.remaining.MEDICAL }}</strong><span>Days available</span></div>
  </section>
  <section class="card">
   <div class="card-header"><div><h2>My leave transactions</h2><p>Pending requests do not deduct balances until approved.</p></div>
    <button @click="load">Refresh</button></div>
   <div class="filters">
     <label>Leave type <SmartSelect v-model="typeFilter" aria-label="Leave type filter" :options="[{value:'',label:'All types'},...['ANNUAL','MEDICAL','EMERGENCY','UNPAID'].map(v=>({value:v,label:v}))]" /></label>
     <label>Decision <SmartSelect v-model="statusFilter" aria-label="Leave status filter" :options="[{value:'',label:'All statuses'},...['PENDING','APPROVED','REJECTED','RETURNED','CANCELLED'].map(v=>({value:v,label:v}))]" /></label>
   </div>
   <p v-if="loading">Loading records…</p>
   <div v-else class="scroll"><table><thead><tr><th>Request ID</th><th>Leave type</th><th>Date range</th><th>Duration</th><th>Approval</th><th>Submitted</th></tr></thead>
    <tbody><tr v-for="r in visible" :key="r.id">
      <td class="mono">{{ r.id.slice(0,8) }}</td><td>{{ r.type }}</td><td>{{ r.startDate }} – {{ r.endDate }}</td>
      <td>{{ r.dayType==='FULL'?'Full day(s)':r.dayType==='AM'?'Morning half':'Afternoon half' }}</td>
      <td><span class="status" :class="r.status.toLowerCase()">{{ r.status }}</span></td>
      <td>{{ new Date(r.createdAt).toLocaleDateString() }}</td>
    </tr><tr v-if="!visible.length"><td colspan="6">No matching transactions.</td></tr></tbody>
   </table></div>
   <button class="secondary" :disabled="!visible.length" @click="exportCSV">Export my records</button>
  </section>
  <section class="card"><h2>Organization policy</h2>
    <p>{{ balances?.note || 'Entitlements are retrieved from your organization policy.' }}</p>
    <div class="links"><router-link to="/leave">Apply for Leave</router-link><router-link to="/leave/team" v-if="isManager">Team Calendar</router-link>
      <router-link to="/admin/parameters" v-if="isAdmin">Configure leave policies</router-link><router-link to="/leave/approvals">Review leave approvals</router-link></div>
  </section>
 </main>
</template>
<script setup>
import SmartSelect from '../../../components/SmartSelect.vue';
import {computed,onMounted,ref} from 'vue';
import axios from '../../../api/axiosConfig';
const records=ref([]),balances=ref(null),loading=ref(false),error=ref(''),typeFilter=ref(''),statusFilter=ref('');
const role=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}').role||'MEMBER';}catch{return 'MEMBER';}})();
const isAdmin=role==='ADMIN',isManager=['ADMIN','PMO','PROJECT_MANAGER'].includes(role);
const visible=computed(()=>records.value.filter(r=>(!typeFilter.value||r.type===typeFilter.value)&&(!statusFilter.value||r.status===statusFilter.value)));
async function load(){loading.value=true;error.value='';try{
 const [leave,balance]=await Promise.all([axios.get('/leave/mine'),axios.get('/leave/balances')]);
 records.value=leave.data.data;balances.value=balance.data.data;
}catch(e){const m=e.response?.data?.message;error.value=Array.isArray(m)?m.join(', '):m||e.message;}finally{loading.value=false;}}
function exportCSV(){
 const headers=['Request ID','Type','Start','End','Day Type','Status','Submitted'];
 const rows=visible.value.map(r=>[r.id,r.type,r.startDate,r.endDate,r.dayType,r.status,r.createdAt]);
 const safe=x=>{let s=String(x??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const csv=[headers,...rows].map(row=>row.map(safe).join(',')).join('\r\n');
 const href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=href;a.download='pmo-personal-leave-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(href);
}
onMounted(load);
</script>
<style scoped>
.history-page{min-height:100vh;background:#f4f7fb;padding:32px;display:grid;gap:20px;align-content:start;color:#18253c}.eyebrow{font-size:11px;color:#355ad3;font-weight:800;letter-spacing:.1em}header h1{font-size:29px;margin:6px 0}header p:not(.eyebrow),.card p{font-size:13px;color:#64748b}.card{background:#fff;border-radius:15px;border:1px solid #e5ebf3;padding:23px;min-width:0}.card h2{font-size:18px;margin:0}.card-header{display:flex;align-items:center;justify-content:space-between;gap:15px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.stats>div{background:#fff;border:1px solid #e5ebf3;border-radius:14px;padding:20px;display:grid;gap:7px}.stats strong{font-size:29px}.stats small,.stats span{font-size:11px;color:#64748b}.filters{display:flex;gap:13px;margin:19px 0;flex-wrap:wrap}label{font-weight:750;font-size:12px;display:grid;gap:7px}select{padding:10px 12px;border:1px solid #d9e0eb;border-radius:9px;background:#f8faff;color:#273b55;font-size:12px}.scroll{overflow:auto;margin:15px 0}table{width:100%;border-collapse:collapse;text-align:left;min-width:700px}th{background:#f1f4f9;color:#66758b;font-size:11px;padding:13px}td{font-size:12px;padding:13px;border-bottom:1px solid #e8edf4}.mono{font-family:monospace}.status{background:#edf1f7;color:#56677e;font-weight:750;border-radius:18px;padding:6px 9px;font-size:10px}.status.pending{background:#fff1d7;color:#9e6917}.status.approved{background:#def7eb;color:#16765a}.status.rejected{background:#ffe8ed;color:#ae3853}button,.links a{border:0;background:#355ad3;color:#fff;border-radius:9px;padding:11px 14px;font-size:12px;font-weight:750;cursor:pointer;text-decoration:none}button.secondary,.links a{background:#edf2fe;color:#355ad3}.links{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap}.alert.error{padding:12px;border-radius:9px;background:#ffe8ed;color:#ae3853}
@media(max-width:960px){.stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.history-page{padding:16px}.card-header{align-items:flex-start;flex-direction:column}}
</style>
