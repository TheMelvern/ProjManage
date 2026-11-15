<template>
  <main class="hub">
    <header><p class="eyebrow">PMO SYSTEM / CONNECTED OPERATIONS</p><h1>Connected Module Workflows</h1>
      <p>Follow approved records from delivery through resource planning, governance, executive reporting and audit.</p></header>
    <section v-for="flow in flows" :key="flow.title" class="card">
      <h2>{{ flow.title }}</h2><p>{{ flow.description }}</p>
      <div class="flow"><template v-for="(node,index) in flow.steps" :key="node.to">
        <router-link :to="node.to" class="node"><small>STEP {{ index+1 }}</small><strong>{{ node.name }}</strong></router-link>
        <span v-if="index<flow.steps.length-1" class="arrow">›</span>
      </template></div>
    </section>
    <section class="card"><h2>Cross-module data contracts</h2><p>Changes are submitted as proposals and become effective only after independent approval.</p>
      <div class="contracts"><article v-for="record in contracts" :key="record.label">
        <strong>{{ record.label }}</strong><span>{{ record.details }}</span>
      </article></div>
      <router-link class="queue-link" to="/approvals">Open pending approvals</router-link>
    </section>
  </main>
</template>
<script setup>
const flows=[
 {title:'Project delivery & governance',description:'Portfolio source records feed project tasks, risk register and executive reporting.',steps:[
  {name:'Projects',to:'/projects'},{name:'RAID',to:'/raid'},{name:'Timesheets',to:'/timesheets'},{name:'Reports',to:'/reports'},{name:'Approval Center',to:'/approvals'}
 ]},
 {title:'Leave & resource availability',description:'Approved leave informs project team coverage and work allocation.',steps:[
  {name:'Leave Tracker',to:'/leave'},{name:'Team Calendar',to:'/leave/team'},{name:'Timesheets',to:'/timesheets'},{name:'Projects',to:'/projects'}
 ]},
 {title:'Administrative governance',description:'Security, role and parameter changes are independently checked and auditable.',steps:[
  {name:'Admin Parameters',to:'/admin/parameters'},{name:'Users & Roles',to:'/admin/users'},{name:'Approval Center',to:'/approvals'},{name:'Audit Log',to:'/admin/audit'}
 ]}
];
const contracts=[
 {label:'Organization & project IDs',details:'Scope each task, RAID record, timesheet and report to the same organization and project.'},
 {label:'Membership & role',details:'Only authorized members can access source records, propose changes and act as checkers.'},
 {label:'Approval & version',details:'Proposals retain maker, checker, prior version and final decision, preventing stale edits.'},
 {label:'Reporting',details:'Live portfolio aggregates approved records. Published snapshots need independent approval.'},
 {label:'Audit trail',details:'Decisions are recorded with actor identity, change type and timestamp.'}
];
</script>
<style scoped>
.hub{background:#f4f7fb;min-height:100vh;padding:32px;display:grid;gap:20px;align-content:start;color:#18253c}.eyebrow{color:#355ad3;font-size:11px;font-weight:800;letter-spacing:.1em}header h1{font-size:29px;margin:6px 0}header p:not(.eyebrow),.card p{color:#64748b;font-size:13px}.card{padding:24px;background:#fff;border:1px solid #e5ebf3;border-radius:15px;min-width:0}.card h2{font-size:19px;margin:0 0 8px}.flow{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:22px}.node{flex:1;min-width:110px;display:grid;gap:7px;background:#eef3fd;border:1px solid #dee7f8;border-radius:11px;padding:14px;text-decoration:none;color:#3258ae}.node small{font-size:10px;color:#7184ac;font-weight:750}.node strong{font-size:12px}.arrow{color:#9cb2d6;font-size:26px}.contracts{display:grid;gap:9px;margin:20px 0}.contracts article{display:grid;grid-template-columns:200px 1fr;gap:18px;background:#f6f8fc;padding:13px;border-radius:9px;font-size:12px}.contracts article span{color:#64748b}.queue-link{display:inline-block;background:#355ad3;color:#fff;text-decoration:none;border-radius:9px;padding:12px 16px;font-size:12px;font-weight:750}
@media(max-width:650px){.hub{padding:17px}.flow{align-items:stretch}.node{min-width:calc(45% - 10px)}.arrow{display:none}.contracts article{grid-template-columns:1fr}}
</style>