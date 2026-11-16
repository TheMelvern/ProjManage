<template>
  <div class="module-space">
    <nav class="module-tabs" :aria-label="moduleLabel + ' tabs'">
      <router-link v-for="tab in tabs" :key="tab.to" :to="tab.to"
        :class="{ selected: activeTab === tab.key }" :aria-current="activeTab === tab.key ? 'page' : undefined">
        {{ tab.label }}
      </router-link>
    </nav>
    <ReviewCenter v-if="activeTab === 'approvals'" :module="module" />
    <TeamAvailability v-else-if="module === 'leave' && activeTab === 'calendar'" />
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
import LeaveTracker from './people/LeaveTracker.vue';
import TeamAvailability from './people/TeamAvailability.vue';
import ReportsView from './projects/reports/ReportsView.vue';
const props=defineProps({module:{type:String,required:true}});
const route=useRoute();
const labels={admin:'Administration',projects:'Projects & Tasks',raid:'RAID Register',timesheets:'Timesheets',leave:'Leave Tracker',reports:'Executive Reports'};
const moduleLabel=computed(()=>labels[props.module]||props.module);
const tabs=computed(()=>props.module==='admin' ? [
  {to:'/admin/parameters',label:'Admin Parameters',key:'parameters'},
  {to:'/admin/users',label:'Users & Roles',key:'users'},
  {to:'/admin/audit',label:'Audit & Security',key:'audit'},
  {to:'/admin/approvals',label:'Approvals',key:'approvals'}
] : props.module === 'leave' ? [
  {to:'/leave',label:'My leave',key:'overview'},
  {to:'/leave/team',label:'Team calendar',key:'calendar'},
  {to:'/leave/approvals',label:'Approvals',key:'approvals'}
] : [
  {to:'/'+props.module,label:'Overview',key:'overview'},
  {to:'/'+props.module+'/approvals',label:'Approvals',key:'approvals'}
]);
const activeTab=computed(()=>route.path.endsWith('/approvals')?'approvals':
  props.module==='admin' ? route.path.split('/')[2]||'parameters' :
  props.module==='leave' && route.path==='/leave/team' ? 'calendar' : 'overview');
</script>
<style scoped>
.module-space{min-width:0;min-height:100vh;background:#f4f7fb}
.module-tabs{display:flex;flex-wrap:wrap;gap:7px;padding:14px 30px 0;border-bottom:1px solid #dfe6f1;background:#fff}
.module-tabs a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:#586b87;padding:12px 17px;font-size:12px;font-weight:750;border-radius:10px 10px 0 0;border-bottom:3px solid transparent;transition:color .15s,background .15s}
.module-tabs a:hover{background:#f0f4fd;color:#315ac4}
.module-tabs a.selected{background:#f0f4fd;color:#315ac4;border-bottom-color:#315ac4}
@media(max-width:600px){.module-tabs{padding:10px 14px 0;gap:3px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}.module-tabs a{white-space:nowrap;padding:11px 12px}}
</style>