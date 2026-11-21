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
        <h2>Inbox</h2>
        <div class="inbox-actions">
          <div class="work-actions" role="group" aria-label="Notification filter">
            <button type="button" class="pmo-control quiet" :aria-pressed="!unreadOnly" @click="unreadOnly=false">All</button>
            <button type="button" class="pmo-control quiet" :aria-pressed="unreadOnly" @click="unreadOnly=true">Unread<span v-if="unread"> · {{ unread }}</span></button>
          </div>
          <button v-if="unread" type="button" class="pmo-control quiet" :disabled="busy" @click="markAll">Mark all read</button>
        </div>
      </div>
      <p v-if="loading" role="status">Loading notifications…</p>
      <p v-else-if="!visibleItems.length" class="empty">{{ unreadOnly ? 'You’re caught up. There are no unread notifications.' : 'No notifications yet. Approval updates will appear here.' }}</p>
      <div v-else class="item-list">
        <article v-for="item in visibleItems" :key="item.id" class="item" :class="{ unread: !item.readAt }">
          <div class="record-icon"><span class="material-symbols-outlined" aria-hidden="true">{{ item.kind === 'REVIEW_DECISION' ? 'fact_check' : 'notifications_active' }}</span></div>
          <div class="item-text"><strong>{{ item.title }}</strong><p>{{ item.body }}</p><small>{{ formatDate(item.createdAt) }}</small></div>
          <span v-if="!item.readAt" class="unread-marker" aria-label="Unread"></span>
          <button v-if="!item.readAt" type="button" class="pmo-control quiet" :disabled="busy" @click="markOne(item)">Mark read</button>
          <router-link v-if="safeLink(item.link)" class="pmo-control quiet" :to="item.link" @click="markOne(item)">Open</router-link>
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
.notification-page {
  display: grid;
  align-content: start;
  gap: 16px;
  max-width: 1120px;
  margin-inline: auto;
  padding-block: clamp(24px, 4vw, 40px);
}
.page-heading, .panel-header, .inbox-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.page-heading, .panel-header { justify-content: space-between; }
.page-heading h1, .panel h2 { margin: 0; }
.page-heading p { margin: 6px 0 0; }
.panel {
  padding: var(--product-panel-space);
  border: 1px solid var(--pmo-border);
}
.item-list { display: grid; margin-block-start: 16px; }
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-block-start: 1px solid var(--pmo-border);
}
.item.unread { background: var(--pmo-surface-alt); }
.item-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.item-text p { margin: 3px 0; }
.unread-marker {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--pmo-accent); flex: none;
}
.empty { padding-block: 18px; }
.error { border-inline-start: 3px solid var(--pmo-danger); padding: 10px; }
@media (max-width: 600px) {
  .item { flex-wrap: wrap; }
  .item-text { flex-basis: calc(100% - 76px); }
}
</style>
