<template>
  <main class="users-screen">
    <header class="page-head"><div><p class="eyebrow">ADMINISTRATION / IDENTITY & ACCESS</p><h1>Users & Roles</h1><p>Manage organization memberships with independent role-change approval.</p></div></header>
    <p v-if="error" class="alert error" role="alert">{{ error }}</p>
    <p v-if="notice" class="alert" role="status">{{ notice }}</p>
    <section class="card">
      <div class="card-heading"><div><h2>Membership directory</h2><p>Search by name or email. Role changes require a second administrator.</p></div><button type="button" class="pmo-control quiet" @click="load">Refresh</button></div>
      <label class="search-label" for="user-search">Search members</label><input id="user-search" v-model.trim="search" placeholder="Search name or work email"/>
      <p v-if="loading" role="status">Loading team members…</p>
      <p v-else-if="error && !directoryLoaded">Use Refresh to try loading the directory again.</p>
      <div class="scroll" v-else tabindex="0" role="region" aria-label="Membership directory table"><table>
        <thead><tr><th>Person</th><th>Work email</th><th>Current role</th><th scope="col">Action</th></tr></thead>
        <tbody><tr v-for="person in visiblePeople" :key="person.userId">
          <td><span class="person"><span class="avatar">{{ initials(person.name) }}</span><strong>{{ person.name }}</strong></span></td>
          <td>{{ person.email }}</td><td><span class="role">{{ roleLabel(person.role) }}</span></td>
          <td><button type="button" class="pmo-control quiet" :aria-label="'Change role for ' + person.name" @click="openRoleEditor(person)">Change role</button></td>
        </tr><tr v-if="!visiblePeople.length"><td colspan="4">No matching members.</td></tr></tbody>
      </table></div>
    </section>
    <PremiumComposeDialog :open="Boolean(editing)" title="Propose a role change" :description="editing?.name || ''" :error="error" @close="editing=null">
      <form v-if="editing" id="role-change-form" @submit.prevent="propose(editing)">
        <p>Current role: <strong>{{ roleLabel(editing.role) }}</strong></p>
        <label>Proposed role
          <SmartSelect v-model="proposedRole" aria-label="Proposed role" :options="roles.map(role=>({value:role,label:roleLabel(role)}))" />
        </label>
        <label>Reason for change
          <textarea v-model.trim="roleReason" required minlength="5" maxlength="300" rows="3" />
        </label>
      </form>
      <template #footer>
        <button type="button" class="pmo-control quiet" @click="editing=null">Cancel</button>
        <button type="submit" form="role-change-form" class="pmo-control primary" :disabled="!editing || busy || editing.role===proposedRole || roleReason.length<5">{{ busy ? 'Submitting…' : 'Submit for review' }}</button>
      </template>
    </PremiumComposeDialog>
    <details class="card role-matrix">
      <summary>Role permission matrix</summary><p>Enforced by the API; the frontend does not grant access by itself.</p>
      <div class="scroll" tabindex="0" role="region" aria-label="Role permission matrix"><table><thead><tr><th>Capability</th><th>Administrator</th><th>PMO</th><th>Project manager</th><th>Member</th></tr></thead>
      <tbody><tr><td>Manage organization parameters and users</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
      <tr><td>Submit delivery & RAID changes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
      <tr><td>Review project & leave changes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
      <tr><td>Submit own timesheets and leave</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Approve user registrations and role changes</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr></tbody></table></div>
    </details>
  </main>
</template>
<script setup>
import PremiumComposeDialog from '../../../components/PremiumComposeDialog.vue';
import SmartSelect from '../../../components/SmartSelect.vue';
import { computed,onMounted,ref } from 'vue';
import axios from '../../../api/axiosConfig';
const people=ref([]),search=ref(''),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const roles=['MEMBER','PROJECT_MANAGER','PMO','ADMIN'];
const editing=ref(null),proposedRole=ref(''),roleReason=ref('');
const roleLabel = role => ({ MEMBER:'Member', PROJECT_MANAGER:'Project manager', PMO:'PMO', ADMIN:'Administrator' })[role] || role;
function openRoleEditor(person) {
  editing.value=person;proposedRole.value=person.role;roleReason.value='';error.value='';
}
const visiblePeople=computed(()=>people.value.filter(p=>(p.name+' '+p.email).toLowerCase().includes(search.value.toLowerCase())));
const initials=n=>String(n||'?').split(/\s+/).slice(0,2).map(w=>w.charAt(0).toUpperCase()).join('');
const message=e=>{const m=e.response?.data?.message;return Array.isArray(m)?m.join(', '):m||e.message||'Request failed';};
const directoryLoaded=ref(false);
async function load(){loading.value=true;error.value='';try {
 people.value=(await axios.get('/admin/users')).data.data;
  directoryLoaded.value=true;
}catch(e){error.value=message(e);}finally{loading.value=false;}}
async function propose(p){if (!p || busy.value || p.role===proposedRole.value || roleReason.value.length<5) return;busy.value=true;error.value='';notice.value='';try{
 await axios.post('/admin/users/proposals',{membershipId:p.membershipId,
   role:proposedRole.value,reason:roleReason.value});
 editing.value=null;
 notice.value='Role change submitted. A different administrator must approve it.';
 await load();
}catch(e){error.value=message(e);}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.users-screen{background:var(--pmo-accent-soft);padding:32px;min-height:100vh;color:var(--pmo-text);display:grid;gap:20px;align-content:start}.page-head,.card-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}.page-head h1{font-size:30px;margin:5px 0}.page-head p:not(.eyebrow),.card p{font-size:13px;color:#69788d}.eyebrow{font-size:11px;letter-spacing:.1em;color:var(--pmo-accent-ink);font-weight:800}.subnav{display:inline-block;text-decoration:none;color:var(--pmo-accent-ink);background:var(--pmo-accent-soft);border-radius:9px;padding:12px;font-size:12px;font-weight:750}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.kpis>div,.card{background:white;border:1px solid var(--pmo-border);border-radius:15px;padding:23px}.kpis>div{display:grid;gap:8px}.kpis small{color:#64748b}.kpis strong{font-size:28px}.card{min-width:0}.card h2{font-size:18px;margin:0}.card-heading{margin-bottom:16px}.search-label{font-size:12px;font-weight:700;display:block;margin:12px 0 7px}input,select{padding:10px 12px;border:1px solid var(--pmo-border);border-radius:9px;background:var(--pmo-accent-soft);color:var(--pmo-text);font-size:12px}input{max-width:390px;width:100%}button{background:var(--pmo-accent);color:var(--pmo-on-accent);border:0;border-radius:8px;padding:10px 13px;font-size:11px;font-weight:700;cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}.scroll{overflow:auto;margin:15px 0}table{width:100%;border-collapse:collapse;text-align:left;min-width:730px}th{background:var(--pmo-accent-soft);color:#64748b;font-size:11px;padding:13px}td{font-size:12px;border-bottom:1px solid var(--pmo-border);padding:14px}.person{display:flex;align-items:center;gap:9px;white-space:nowrap}.avatar{width:32px;height:32px;flex:none;display:inline-grid;place-items:center;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);border-radius:50%;font-size:10px;font-weight:800}.role{font-size:11px;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);border-radius:15px;padding:6px 9px}.alert{border-radius:9px;padding:13px;background:#e4f8ed;color:#187756}.alert.error{background:#ffe8ed;color:#af344c}
@media(max-width:720px){.users-screen{padding:16px}.kpis{grid-template-columns:1fr}.page-head,.card-heading{align-items:flex-start;flex-direction:column}}
</style>
