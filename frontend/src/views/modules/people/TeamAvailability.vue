<template>
  <main class="availability">
    <header class="head"><div><p class="eyebrow">PEOPLE OPERATIONS / TEAM AVAILABILITY</p><h1>Team Leave Calendar</h1>
      <p>Approved absences across the organization, available to authorized project and people managers.</p></div>
      <router-link to="/leave">Back to Leave Tracker</router-link>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section class="metrics">
      <article><small>Approved leave records</small><strong>{{ records.length }}</strong></article>
      <article><small>People away this month</small><strong>{{ uniqueEmployees }}</strong></article>
      <article><small>Team coverage conflicts</small><strong>{{ overlaps }}</strong></article>
    </section>
    <section class="card">
      <div class="calendar-head"><h2>{{ monthLabel }}</h2><div class="controls">
        <button @click="changeMonth(-1)" aria-label="Previous month">‹</button>
        <button @click="changeMonth(1)" aria-label="Next month">›</button>
        <button @click="load">Refresh</button>
      </div></div>
      <p v-if="loading">Loading approved team absences…</p>
      <div v-else class="calendar-scroll"><div class="calendar-grid">
        <span v-for="day in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="day" class="day-name">{{ day }}</span>
        <div v-for="cell in cells" :key="cell.key" class="day" :class="{muted:!cell.current,hasLeave:cell.events.length>0}">
          <span class="number">{{ cell.date.getDate() }}</span>
          <span v-for="item in cell.events.slice(0,3)" :key="item.id" class="event" :title="item.employeeName+' · '+item.type">
            <span class="avatar">{{ initials(item.employeeName) }}</span>{{ item.employeeName }}
          </span>
          <small v-if="cell.events.length>3">+{{ cell.events.length-3 }} more</small>
        </div>
      </div></div>
    </section>
    <section class="card"><div class="calendar-head"><h2>Absences this month</h2><span>{{ monthly.length }} records</span></div>
      <div v-if="!monthly.length" class="empty">No approved leave within this month.</div>
      <div v-else class="absence-list"><article v-for="item in monthly" :key="item.id">
        <span class="avatar">{{ initials(item.employeeName) }}</span>
        <div><strong>{{ item.employeeName }}</strong><small>{{ item.type }} · {{ item.startDate }} to {{ item.endDate }}</small></div>
        <span class="approved">Approved</span>
      </article></div>
      <router-link class="related-link" to="/workspace">Review project delivery</router-link>
    </section>
  </main>
</template>
<script setup>
import { computed,onMounted,ref } from 'vue';
import axios from '../../../api/axiosConfig';
const month=ref(new Date().getMonth()),year=ref(new Date().getFullYear());
const records=ref([]),error=ref(''),loading=ref(false);
const monthLabel=computed(()=>new Date(year.value,month.value,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'}));
const start=computed(()=>year.value+'-'+String(month.value+1).padStart(2,'0')+'-01');
const end=computed(()=>new Date(Date.UTC(year.value,month.value+1,0)).toISOString().slice(0,10));
const monthly=computed(()=>records.value.filter(x=>x.startDate<=end.value&&x.endDate>=start.value));
const uniqueEmployees=computed(()=>new Set(monthly.value.map(x=>x.employeeId)).size);
const overlaps=computed(()=>{
 let count=0;const r=monthly.value;
 for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){
   if(r[i].employeeId!==r[j].employeeId&&r[i].startDate<=r[j].endDate&&r[i].endDate>=r[j].startDate)count++;
 }return count;
});
const cells=computed(()=>{
 const first=new Date(year.value,month.value,1);
 const offset=(first.getDay()+6)%7;
 const firstCell=new Date(year.value,month.value,1-offset);
 return Array.from({length:42},(_,i)=>{
  const date=new Date(firstCell);date.setDate(date.getDate()+i);
  const dayKey=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  return {key:dayKey,date,current:date.getMonth()===month.value,
    events:monthly.value.filter(item=>item.startDate<=dayKey&&item.endDate>=dayKey)};
 });
});
const initials=n=>String(n||'?').split(/\s+/).slice(0,2).map(w=>w[0].toUpperCase()).join('');
function changeMonth(change){const d=new Date(year.value,month.value+change,1);month.value=d.getMonth();year.value=d.getFullYear();}
async function load(){loading.value=true;error.value='';try{
 records.value=(await axios.get('/leave/team')).data.data;
}catch(e){const m=e.response?.data?.message;error.value=Array.isArray(m)?m.join(', '):m||e.message;}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.availability{background:#f4f7fb;min-height:100vh;color:#18253c;padding:32px;display:grid;gap:20px;align-content:start}.head,.calendar-head{display:flex;align-items:center;justify-content:space-between;gap:20px}.head h1{font-size:29px;margin:6px 0}.head p:not(.eyebrow){font-size:13px;color:#64748b}.eyebrow{font-size:11px;font-weight:800;color:#355ad3;letter-spacing:.1em}.head a,.related-link{background:#edf2fb;color:#315ac4;padding:11px 14px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.metrics article,.card{background:#fff;border-radius:15px;border:1px solid #e2e9f2;padding:22px}.metrics article{display:grid;gap:9px}.metrics strong{font-size:28px}.metrics small{color:#64748b}.card{min-width:0}.card h2{font-size:18px;margin:0}.controls{display:flex;gap:8px}.controls button{border:1px solid #dbe4f1;background:#f3f6fb;color:#355ad3;font-weight:750;border-radius:9px;padding:9px 14px;cursor:pointer}.calendar-scroll{overflow:auto;margin-top:20px}.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(100px,1fr));gap:5px;min-width:740px}.day-name{text-align:center;background:#f1f4f9;color:#66758b;padding:12px;font-size:11px;font-weight:800;border-radius:7px}.day{min-height:110px;border:1px solid #e7edf5;padding:10px;border-radius:8px;background:#fff;display:flex;flex-direction:column;gap:5px}.day.muted{background:#f8fafc;color:#9ca7b8}.day.hasLeave{border-color:#adc0f0}.number{font-size:11px;font-weight:800}.event{display:flex;align-items:center;gap:5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:#edf3fc;border-radius:7px;padding:5px;color:#3558aa;font-size:10px}.avatar{width:22px;height:22px;flex:none;border-radius:50%;background:#dbe5fb;color:#315ac4;font-size:8px;font-weight:800;display:grid;place-items:center}.absence-list{display:grid;gap:9px;margin:18px 0}.absence-list article{display:flex;gap:12px;align-items:center;background:#f7f9fc;padding:12px;border-radius:9px}.absence-list .avatar{height:35px;width:35px;font-size:10px}.absence-list article>div{flex:1}.absence-list strong{display:block;font-size:12px}.absence-list small{font-size:11px;color:#64748b}.approved{font-size:10px;color:#16805d;background:#dff7e9;border-radius:14px;padding:6px}.empty{color:#64748b;padding:22px 0}
@media(max-width:720px){.availability{padding:17px}.head{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr}.calendar-head{flex-wrap:wrap}}
</style>
