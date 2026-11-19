<template>
  <div class="module-space">
    <nav class="module-tabs" :aria-label="moduleLabel + ' tabs'">
      <router-link v-for="tab in tabs" :key="tab.to" :to="tab.to"
        :class="{ selected: activeTab === tab.key }" :aria-current="activeTab === tab.key ? 'page' : undefined">
        {{ tab.label }}
      </router-link>
    </nav>
    <section v-if="module === 'admin' && !canManageParameters" class="permission-explainer" role="status"><span class="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span><h2>Parameters</h2><p>Organization parameters and security administration require an Administrator role. Contact your workspace administrator if you need to propose configuration changes.</p></section>
    <ReviewCenter v-else-if="activeTab === 'approvals'" :module="module" />
    <TeamAvailability v-else-if="module === 'leave' && activeTab === 'calendar'" />
    <LeaveRecords v-else-if="module === 'leave' && activeTab === 'records'" />
    <template v-else>
      <Parameters v-if="module === 'admin' && activeTab === 'parameters'" />
      <UserAdmin v-else-if="module === 'admin' && activeTab === 'users'" />
      <AuditLog v-else-if="module === 'admin' && activeTab === 'audit'" />
      <ProjectWorkspace v-else-if="module === 'projects'" />
      <RaidWorkspace v-else-if="module === 'raid'" />
      <TimesheetWorkspace v-else-if="module === 'timesheets'" />
      <LeaveTracker v-else-if="module === 'leave'" />
      <ReportsView v-else-if="module === 'reports'" />
    </template>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ReviewCenter from './administration/ReviewCenter.vue';
import Parameters from './administration/Parameters.vue';
import UserAdmin from './administration/UserAdmin.vue';
import AuditLog from './administration/AuditLog.vue';
import ProjectWorkspace from './projects/ProjectWorkspace.vue';
import RaidWorkspace from './projects/RaidWorkspace.vue';
import TimesheetWorkspace from './projects/TimesheetWorkspace.vue';
import LeaveRecords from './people/LeaveRecords.vue';
import LeaveTracker from './people/LeaveTracker.vue';
import TeamAvailability from './people/TeamAvailability.vue';
import ReportsView from './projects/reports/ReportsView.vue';
const props=defineProps({module:{type:String,required:true}});
const route=useRoute();
const canManageParameters=computed(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}').role==='ADMIN';}catch{return false;}});
const canSeeCalendar=computed(()=>{
  try{return ['ADMIN','PMO','PROJECT_MANAGER'].includes(JSON.parse(localStorage.getItem('user')||'{}').role);}catch{return false;}
});
const labels={admin:'Administration',projects:'Projects & Tasks',raid:'RAID Register',timesheets:'Timesheets',leave:'Leave Tracker',reports:'Executive Reports'};
const moduleLabel=computed(()=>labels[props.module]||props.module);
const tabs=computed(()=>props.module==='admin' ? [
  {to:'/admin/parameters',label:'Admin Parameters',key:'parameters'},
  {to:'/admin/users',label:'Users & Roles',key:'users'},
  {to:'/admin/audit',label:'Audit & Security',key:'audit'},
  {to:'/admin/approvals',label:'Approvals',key:'approvals'}
] : props.module === 'leave' ? [
  {to:'/leave',label:'My leave',key:'overview'},
  {to:'/leave/records',label:'Records & policy',key:'records'},
  ...(canSeeCalendar.value ? [{to:'/leave/team',label:'Team calendar',key:'calendar'}] : []),
  {to:'/leave/approvals',label:'Approvals',key:'approvals'}
] : [
  {to:'/'+props.module,label:'Overview',key:'overview'},
  {to:'/'+props.module+'/approvals',label:'Approvals',key:'approvals'}
]);
const activeTab=computed(()=>route.path.split('/').includes('approvals')?'approvals':
  props.module==='admin' ? route.path.split('/')[2]||'parameters' :
  props.module==='leave' && route.path==='/leave/team' ? 'calendar' :
  props.module==='leave' && route.path==='/leave/records' ? 'records' : 'overview');
</script>
<style scoped>
.module-space{min-width:0;min-height:100vh;background:var(--pmo-accent-soft)}
.module-tabs{display:flex;flex-wrap:wrap;gap:7px;padding:14px 30px 0;border-bottom:1px solid var(--pmo-border);background:#fff}
.module-tabs a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:#586b87;padding:12px 17px;font-size:12px;font-weight:750;border-radius:10px 10px 0 0;border-bottom:3px solid transparent;transition:color .15s,background .15s}
.module-tabs a:hover{background:var(--pmo-accent-soft);color:var(--pmo-accent-ink)}
.module-tabs a.selected{background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);border-bottom-color:var(--pmo-accent)}
@media(max-width:600px){.module-tabs{padding:10px 14px 0;gap:3px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}.module-tabs a{white-space:nowrap;padding:11px 12px}}
.permission-explainer{margin:34px;padding:38px;max-width:720px;background:var(--pmo-panel,#fff);color:var(--pmo-text,#1d1d1f);border:1px solid var(--pmo-border,#eee);border-radius:22px}.permission-explainer .material-symbols-outlined{font-size:32px;color:var(--pmo-accent,var(--pmo-accent-ink))}.permission-explainer h2{font-size:24px;margin:16px 0 10px}.permission-explainer p{line-height:1.6;color:var(--pmo-muted,#6e6e73)}
</style>