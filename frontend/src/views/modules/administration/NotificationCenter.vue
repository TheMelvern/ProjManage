<template>
  <main class="notification-page">
    <header class="page-heading">
      <div>

        <h1>Notification Center</h1>
        <p>Approval requests, decisions and operational updates addressed to your account.</p>
      </div>
      <button type="button" class="pmo-control quiet" @click="refresh" :disabled="loading">Refresh</button>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section class="panel">
      <div class="panel-header">
        <div><h2>Inbox</h2><div class="work-actions" role="group" aria-label="Notification filter">
          <button type="button" class="pmo-control quiet" :aria-pressed="!unreadOnly" @click="unreadOnly=false">All</button>
          <button type="button" class="pmo-control quiet" :aria-pressed="unreadOnly" @click="unreadOnly=true">Unread<span v-if="unread"> · {{ unread }}</span></button>
        </div></div>
        <button v-if="unread" type="button" class="pmo-control quiet" :disabled="busy" @click="markAll">Mark all read</button>
      </div>
      <p v-if="loading" role="status">Loading notifications…</p>
      <p v-else-if="!visibleItems.length" class="empty">{{ unreadOnly ? 'You’re caught up. There are no unread notifications.' : 'No notifications yet. Approval updates will appear here.' }}</p>
      <div v-else class="item-list">
        <article v-for="item in visibleItems" :key="item.id" class="item" :class="{ unread: !item.readAt }">
          <div class="circle"><span class="material-symbols-outlined" aria-hidden="true">{{ item.kind === 'REVIEW_DECISION' ? 'fact_check' : 'notifications_active' }}</span></div>
          <div class="item-text"><strong>{{ item.title }}</strong><p>{{ item.body }}</p><small>{{ formatDate(item.createdAt) }}</small></div>
          <span v-if="!item.readAt" class="unread-marker" aria-label="Unread"></span>
          <button v-if="!item.readAt" type="button" class="secondary" :disabled="busy" @click="markOne(item)">Mark read</button>
          <router-link v-if="safeLink(item.link)" class="action-link" :to="item.link" @click="markOne(item)">Open</router-link>
        </article>
      </div>
    </section>
  </main>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import axios from '../../../api/axiosConfig';
const items=ref([]),unread=ref(0),loading=ref(false),busy=ref(false),error=ref('');
const formatDate=value=>new Date(value).toLocaleString();
const isRequestLink = link => /^\/(projects|raid|timesheets|leave|reports|admin)\/approvals\/[0-9a-f-]{36}$/i.test(link);
const unreadOnly = ref(false);
const visibleItems = computed(() => unreadOnly.value ? items.value.filter(item => !item.readAt) : items.value);
const safeLink=link=>typeof link==='string'&&['/approvals','/projects/approvals','/raid/approvals','/timesheets/approvals','/leave/approvals','/reports/approvals','/admin/approvals','/leave','/projects','/reports','/timesheets','/admin/users'].includes(link) || (typeof link === 'string' && isRequestLink(link));
function message(err){const v=err.response?.data?.message;return Array.isArray(v)?v.join(', '):v||err.message||'Notification action failed';}
async function refresh(){loading.value=true;error.value='';try{
 const result=(await axios.get('/notifications')).data.data;
 items.value=result.items;unread.value=result.unread;
}catch(err){error.value=message(err);}finally{loading.value=false;}}
async function markOne(item){
 if(item.readAt || busy.value)return;
 busy.value=true;try{
  await axios.patch('/notifications/'+encodeURIComponent(item.id)+'/read');
  item.readAt=new Date().toISOString();unread.value=Math.max(0,unread.value-1);
 }catch(err){error.value=message(err);}finally{busy.value=false;}
}
async function markAll(){busy.value=true;try{
 await axios.patch('/notifications/read-all');items.value.forEach(x=>x.readAt ||= new Date().toISOString());unread.value=0;
}catch(err){error.value=message(err);}finally{busy.value=false;}}
onMounted(refresh);
</script>
<style scoped>
.notification-page{min-height:100vh;background:var(--pmo-accent-soft);padding:30px;display:grid;gap:20px;align-content:start;color:#17243a}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.eyebrow{font-size:11px;color:var(--pmo-accent-ink);font-weight:800;letter-spacing:.1em}.page-heading h1{font-size:29px;margin:7px 0}.page-heading p:not(.eyebrow),.panel-header p{font-size:13px;color:#68788c}.stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.stat-grid article,.panel{background:white;border:1px solid var(--pmo-border);border-radius:15px;padding:24px}.stat-grid article{display:grid;gap:9px}.stat-grid span,.stat-grid small{font-size:12px;color:#68788c}.stat-grid strong{font-size:30px}.panel-header{display:flex;align-items:center;justify-content:space-between;gap:15px}.panel h2{font-size:19px;margin:0}.item-list{display:grid;gap:10px;margin-top:21px}.item{display:flex;align-items:center;gap:13px;border:1px solid var(--pmo-border);border-radius:11px;padding:15px}.item.unread{border-color:var(--pmo-border);background:var(--pmo-accent-soft)}.circle{height:41px;width:41px;border-radius:50%;display:grid;place-items:center;background:var(--pmo-accent-soft);color:var(--pmo-accent-ink);flex:none}.item-text{flex:1;min-width:0}.item-text strong{font-size:13px}.item-text p{font-size:12px;margin:7px 0;color:#4e6078}.item-text small{font-size:11px;color:#748399}.unread-marker{background:var(--pmo-accent);border-radius:50%;height:7px;width:7px;flex:none}button,.action-link{font:inherit;font-size:12px;font-weight:750;border:0;background:var(--pmo-accent);color:var(--pmo-on-accent);padding:10px 13px;border-radius:8px;cursor:pointer;text-decoration:none}.secondary{background:var(--pmo-accent-soft);color:var(--pmo-accent-ink)}.action-link{display:inline-block}.empty{padding:28px 0;color:#6c7a8f;font-size:13px}.error{background:#ffe8ef;color:#a82c49;padding:12px;border-radius:9px}
@media(max-width:700px){.notification-page{padding:16px}.page-heading,.panel-header{align-items:flex-start;flex-direction:column}.item{flex-wrap:wrap}.item-text{min-width:65%}}
</style>