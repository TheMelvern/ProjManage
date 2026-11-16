<template>
  <div v-if="isLogin" class="app-shell-login"><router-view /></div>
  <div v-else class="app-shell">
    <aside class="app-sidebar" :class="{ 'sidebar-open': menuOpen }" aria-label="Primary navigation">
      <div class="app-brand"><span class="brand-symbol">P</span><span>PMO Portal</span></div>
      <p class="nav-category">WORKSPACE</p>
      <nav class="sidebar-links" aria-label="PMO modules">
        <router-link v-for="item in visibleNavigation" :key="item.to" :to="item.to"
           :aria-current="(route.path === item.to || route.path === item.to + '/approvals' || (item.to === '/admin/parameters' && route.path.startsWith('/admin/'))) ? 'page' : undefined" @click="menuOpen = false">
          <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-bottom">
        <button type="button" class="sidebar-signout" @click="logout">
          <span class="material-symbols-outlined" aria-hidden="true">logout</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
    <div class="app-content">
      <header class="app-topbar">
        <button type="button" class="menu-toggle" @click="menuOpen = !menuOpen"
          :aria-expanded="menuOpen" aria-label="Toggle navigation">
          <span class="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <div class="topbar-label">{{ pageTitle }}</div>
        <div class="topbar-right">
          <div class="notification-anchor" ref="notificationAnchor">
            <button type="button" class="notification-shortcut" title="Recent notifications" aria-label="Recent notifications" :aria-expanded="notificationsOpen" aria-haspopup="dialog" @click="toggleNotifications">
              <span class="material-symbols-outlined">notifications</span><span v-if="unreadCount" class="notification-count">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
            </button>
            <section v-if="notificationsOpen" class="notification-popover" role="dialog" aria-label="Recent notifications">
              <div class="notification-popover-head"><strong>Recent activity</strong><span>{{ unreadCount }} unread</span></div>
              <p v-if="notificationError" class="notification-popover-error" role="alert">{{ notificationError }}</p>
              <p v-else-if="notificationLoading" class="notification-popover-empty">Loading updates…</p>
              <p v-else-if="!recentNotifications.length" class="notification-popover-empty">No notifications yet.</p>
              <div v-else class="notification-popover-list">
                <article v-for="item in recentNotifications" :key="item.id" class="notification-popover-item" :class="{ unread: !item.readAt }">
                  <strong>{{ item.title }}</strong><p>{{ item.body }}</p><small>{{ new Date(item.createdAt).toLocaleString() }}</small>
                </article>
              </div>
              <router-link class="notification-view-all" to="/notifications" @click="notificationsOpen = false">View details · Notification Center</router-link>
            </section>
          </div>
          <button type="button" class="profile-badge profile-badge-button" :title="currentUser"
            :aria-label="'Manage profile for ' + currentUser" @click="profileOpen = true"><img v-if="profileData.avatarDataUrl" :src="profileData.avatarDataUrl" alt="" class="topbar-avatar-image" />{{ profileData.avatarDataUrl ? '' : userInitials }}</button>
        </div>
      </header>
      <router-view />
    </div>
    <ProfileManagementModal v-if="profileOpen" @close="profileOpen = false"
      @updated="onProfileUpdated" @password-changed="onPasswordChanged" />
    <button v-if="menuOpen" type="button" class="mobile-backdrop"
      aria-label="Close navigation" @click="menuOpen = false" />
  </div>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axiosInstance from './api/axiosConfig';
import ProfileManagementModal from './views/modules/administration/ProfileManagementModal.vue';
import {applyStoredAppearance,resetAppearance} from './utils/appearance';
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const profileOpen = ref(false);
const profileData = ref(readStoredProfile());
applyStoredAppearance(profileData.value);
async function refreshProfile(){
  if(!localStorage.getItem('access_token'))return;
  try{const updated=(await axiosInstance.get('/profile')).data.data;onProfileUpdated(updated);}
  catch{/* Keep the existing authenticated session if profile lookup is unavailable. */}
}
function readStoredProfile(){
  try { return JSON.parse(localStorage.getItem('user') || '{}'); }
  catch { return {}; }
}
const unreadCount = ref(0);
const notificationsOpen=ref(false),recentNotifications=ref([]),notificationLoading=ref(false),notificationError=ref(''),notificationAnchor=ref(null);
async function refreshUnread(){
  if (!localStorage.getItem('access_token')) { unreadCount.value=0; return; }
  try { const result = await axiosInstance.get('/notifications'); unreadCount.value=result.data.data.unread; recentNotifications.value=result.data.data.items.slice(0,5); }
  catch { unreadCount.value=0; }
}
watch(()=>route.fullPath,()=>{notificationsOpen.value=false;refreshUnread();});
function onOutsideClick(event){if(notificationAnchor.value&&!notificationAnchor.value.contains(event.target))notificationsOpen.value=false;}
function onEscape(event){if(event.key==='Escape')notificationsOpen.value=false;}
async function toggleNotifications(){notificationsOpen.value=!notificationsOpen.value;if(!notificationsOpen.value)return;notificationLoading.value=true;notificationError.value='';try{await refreshUnread();}catch{notificationError.value='Unable to load recent notifications.';}finally{notificationLoading.value=false;}}
onMounted(()=>{refreshUnread();refreshProfile();document.addEventListener('pointerdown',onOutsideClick);document.addEventListener('keydown',onEscape);});
onUnmounted(()=>{document.removeEventListener('pointerdown',onOutsideClick);document.removeEventListener('keydown',onEscape);});
const navigation = [
  { to: '/portfolio', label: 'Portfolio Overview', icon: 'dashboard' },
  { to: '/projects', label: 'Projects & Tasks', icon: 'task_alt' },
  { to: '/raid', label: 'RAID Register', icon: 'warning_amber' },
  { to: '/timesheets', label: 'Timesheets', icon: 'schedule' },
  { to: '/leave', label: 'Leave Tracker', icon: 'event_available' },
  { to: '/reports', label: 'Executive Reports', icon: 'summarize' },
  { to: '/admin/parameters', label: 'Parameters', icon: 'tune', adminOnly: true }
];
const isLogin = computed(() => ['Login', 'Signup', 'VerifyEmail', 'ResendVerification', 'ForgotPassword', 'ResetPassword'].includes(route.name));
const currentRole = computed(() => {
  return profileData.value.role || 'MEMBER';
});
const visibleNavigation = computed(() => navigation.filter(item =>
  (!item.adminOnly || currentRole.value === 'ADMIN') &&
  (!item.managerOnly || ['ADMIN','PMO','PROJECT_MANAGER'].includes(currentRole.value))));

const pageTitle = computed(() =>
  route.path.startsWith('/projects/') && !route.path.endsWith('/approvals') ? 'Projects & Tasks' :
  route.path === '/notifications' ? 'Notification Center' :
  route.path.startsWith('/admin/') ? 'Parameters' :
  (route.path.startsWith('/leave/') ? 'Leave Tracker' : navigation.find(item => route.path === item.to || route.path === item.to + '/approvals')?.label) || 'PMO Portal'
);
const currentUser = computed(() => {
  return profileData.value.name || profileData.value.email || 'Signed in';
});
const userInitials = computed(() => currentUser.value.split(/[\\s@.]+/).slice(0,2).map(w => w.charAt(0).toUpperCase()).join('') || 'PM');
function onProfileUpdated(updated) {
  profileData.value = { ...profileData.value, ...updated };
  localStorage.setItem('user', JSON.stringify(profileData.value));
  applyStoredAppearance(profileData.value);
}
function onPasswordChanged() {
  profileOpen.value = false;
  clearLocalSession();
  router.replace({ name: 'Login' });
}
function clearLocalSession(){
  ['access_token', 'auth_token', 'auth-token', 'user'].forEach(key => localStorage.removeItem(key));
  profileData.value = {};
  resetAppearance();
  menuOpen.value = false;
  unreadCount.value = 0;
  notificationsOpen.value=false;
}

async function logout() {
  try {
    if (localStorage.getItem('access_token')) await axiosInstance.post('/auth/logout');
  } catch {
    // Local sign-out must still clear the browser token if the API is offline.
  }
  clearLocalSession();
  profileOpen.value = false;
  router.replace({ name: 'Login' });
}
</script>
