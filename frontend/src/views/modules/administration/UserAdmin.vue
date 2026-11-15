<template>
  <main class="users-screen">
    <header class="page-head"><div><p class="eyebrow">ADMINISTRATION / IDENTITY & ACCESS</p><h1>Users & Roles</h1><p>Manage organization memberships with independent role-change approval.</p></div>
      <router-link class="subnav" to="/admin/parameters">Parameter Overview</router-link></header>
    <p v-if="error" class="alert error" role="alert">{{ error }}</p>
    <p v-if="notice" class="alert" role="status">{{ notice }}</p>
    <div class="kpis"><div><small>Organization members</small><strong>{{ people.length }}</strong></div><div><small>Administrators</small><strong>{{ admins }}</strong></div><div><small>Pending access changes</small><strong>{{ pendingChanges }}</strong></div></div>
    <section class="card">
      <div class="card-heading"><div><h2>Membership directory</h2><p>Search by name or email. Role changes require a second administrator.</p></div><button type="button" @click="load">Refresh</button></div>
      <label class="search-label" for="user-search">Search members</label><input id="user-search" v-model.trim="search" placeholder="Search name or work email"/>
      <p v-if="loading">Loading team members…</p>
      <div class="scroll" v-else><table>
        <thead><tr><th>Person</th><th>Work email</th><th>Current role</th><th>Proposed role</th><th>Governance</th></tr></thead>
        <tbody><tr v-for="person in visiblePeople" :key="person.userId">
          <td><span class="person"><span class="avatar">{{ initials(person.name) }}</span><strong>{{ person.name }}</strong></span></td>
          <td>{{ person.email }}</td><td><span class="role">{{ person.role }}</span></td>
          <td><select :aria-label="'Role for '+person.name" :value="draftRoles[person.membershipId] || person.role" @change="draftRoles[person.membershipId] = $event.target.value">
            <option v-for="role in roles" :key="role" :value="role">{{ role }}</option></select></td>
          <td><button :disabled="busy || (draftRoles[person.membershipId] || person.role) === person.role"
            @click="propose(person)">Submit for check</button></td>
        </tr><tr v-if="!visiblePeople.length"><td colspan="5">No matching members.</td></tr></tbody>
      </table></div>
    </section>
    <section class="card">
      <h2>Role permission matrix</h2><p>Enforced by the API; the frontend does not grant access by itself.</p>
      <div class="scroll"><table><thead><tr><th>Capability</th><th>ADMIN</th><th>PMO</th><th>PROJECT_MANAGER</th><th>MEMBER</th></tr></thead>
      <tbody><tr><td>Manage organization parameters and users</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
      <tr><td>Submit delivery & RAID changes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
      <tr><td>Review project & leave changes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
      <tr><td>Submit own timesheets and leave</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Approve user registrations and role changes</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr></tbody></table></div>
      <router-link class="subnav" to="/approvals">Open maker–checker queue</router-link>
    </section>
  </main>
</template>
<script setup>
import { computed,onMounted,ref } from 'vue';
import axios from '../../../api/axiosConfig';
const people=ref([]),reviews=ref([]),draftRoles=ref({}),search=ref(''),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const roles=['MEMBER','PROJECT_MANAGER','PMO','ADMIN'];
const admins=computed(()=>people.value.filter(p=>p.role==='ADMIN').length);
const pendingChanges=computed(()=>reviews.value.filter(r=>r.kind==='MEMBERSHIP_UPDATE'&&r.status==='PENDING').length);
const visiblePeople=computed(()=>people.value.filter(p=>(p.name+' '+p.email).toLowerCase().includes(search.value.toLowerCase())));
const initials=n=>String(n||'?').split(/\s+/).slice(0,2).map(w=>w.charAt(0).toUpperCase()).join('');
const message=e=>{const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Request failed';};
async function load(){loading.value=true;error.value='';try {
 const [users,pending]=await Promise.all([axios.get('/admin/users'),axios.get('/reviews')]);
 people.value=users.data.data;reviews.value=pending.data.data;
}catch(e){error.value=message(e);}finally{loading.value=false;}}
async function propose(p){busy.value=true;error.value='';notice.value='';try{
 await axios.post('/admin/users/proposals',{membershipId:p.membershipId,
   role:draftRoles.value[p.membershipId],reason:'Review '+p.name+' membership role change'});
 notice.value='Role change submitted. A different administrator must approve it.';
 await load();
}catch(e){error.value=message(e);}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.users-screen{background:#f4f7fb;padding:32px;min-height:100vh;color:#18253c;display:grid;gap:20px;align-content:start}.page-head,.card-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}.page-head h1{font-size:30px;margin:5px 0}.page-head p:not(.eyebrow),.card p{font-size:13px;color:#69788d}.eyebrow{font-size:11px;letter-spacing:.1em;color:#355ad3;font-weight:800}.subnav{display:inline-block;text-decoration:none;color:#355ad3;background:#eaf0fd;border-radius:9px;padding:12px;font-size:12px;font-weight:750}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.kpis>div,.card{background:white;border:1px solid #e2e9f3;border-radius:15px;padding:23px}.kpis>div{display:grid;gap:8px}.kpis small{color:#64748b}.kpis strong{font-size:28px}.card{min-width:0}.card h2{font-size:18px;margin:0}.card-heading{margin-bottom:16px}.search-label{font-size:12px;font-weight:700;display:block;margin:12px 0 7px}input,select{padding:10px 12px;border:1px solid #d8e1ee;border-radius:9px;background:#fbfcff;color:#253a58;font-size:12px}input{max-width:390px;width:100%}button{background:#355ad3;color:white;border:0;border-radius:8px;padding:10px 13px;font-size:11px;font-weight:700;cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}.scroll{overflow:auto;margin:15px 0}table{width:100%;border-collapse:collapse;text-align:left;min-width:730px}th{background:#f0f4fa;color:#64748b;font-size:11px;padding:13px}td{font-size:12px;border-bottom:1px solid #e8edf5;padding:14px}.person{display:flex;align-items:center;gap:9px;white-space:nowrap}.avatar{width:32px;height:32px;flex:none;display:inline-grid;place-items:center;background:#e1eafd;color:#355ad3;border-radius:50%;font-size:10px;font-weight:800}.role{font-size:11px;background:#eef2fb;color:#3052ac;border-radius:15px;padding:6px 9px}.alert{border-radius:9px;padding:13px;background:#e4f8ed;color:#187756}.alert.error{background:#ffe8ed;color:#af344c}
@media(max-width:720px){.users-screen{padding:16px}.kpis{grid-template-columns:1fr}.page-head,.card-heading{align-items:flex-start;flex-direction:column}}
</style>
