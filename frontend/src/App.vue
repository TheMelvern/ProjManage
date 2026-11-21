<template>
  <div v-if="isLogin" class="app-shell-login"><router-view /></div>
  <div v-else class="app-shell">
    <aside id="workspace-navigation" ref="sidebar" :inert="compact && !menuOpen" class="app-sidebar" :class="{ 'sidebar-open': menuOpen }" aria-label="Primary navigation">
      <div class="app-brand"><span class="brand-symbol">P</span><span>PMO Portal</span>
        <button v-if="compact" class="drawer-close" type="button" aria-label="Close navigation" @click="closeNavigation(true)"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <nav class="sidebar-links" aria-label="PMO modules">
        <template v-for="group in navigationGroups" :key="group.title">
          <p v-if="group.title" class="nav-category">{{ group.title }}</p>
          <router-link v-for="item in group.items" :key="item.to" :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined" @click="closeNavigation(route.path === item.to)">
          <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          </router-link>
        </template>
      </nav>
      <div class="sidebar-bottom">
        <button type="button" class="sidebar-signout" @click="logout">
          <span class="material-symbols-outlined" aria-hidden="true">logout</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
    <div class="app-content" :inert="compact && menuOpen">
      <header class="app-topbar">
        <button type="button" ref="menuTrigger" class="menu-toggle" aria-controls="workspace-navigation" @click="openNavigation"
          :aria-expanded="menuOpen" aria-label="Toggle navigation">
          <span class="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <div class="topbar-label">
          <span v-if="currentGroup" class="topbar-area">{{ currentGroup.title }}</span>
          <span class="topbar-destination">{{ pageTitle }}</span>
        </div>
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
      <router-view v-slot="{ Component }">
        <component :is="Component" v-bind="route.name === 'Workplace' ? { role: currentRole } : {}" />
      </router-view>
    </div>
    <ProfileManagementModal v-if="profileOpen" @close="profileOpen = false"
      @updated="onProfileUpdated" @password-changed="onPasswordChanged" />
    <div v-if="compact && menuOpen" class="mobile-backdrop" aria-hidden="true" @click="closeNavigation(true)" />
  </div>
</template>
<script setup>
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { allowedWorkplaceGroups, workplaceGroups, workplaceHome } from './workplaceNavigation';
import axiosInstance from './api/axiosConfig';
import ProfileManagementModal from './views/modules/administration/ProfileManagementModal.vue';
import {applyStoredAppearance,resetAppearance} from './utils/appearance';
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const sidebar = ref(null), menuTrigger = ref(null);
const compactQuery = window.matchMedia('(max-width: 900px)');
const compact = ref(compactQuery.matches);
function syncViewport(event) {
  compact.value = event.matches;
  if (!event.matches) menuOpen.value = false;
}
async function openNavigation() {
  menuOpen.value = true;
  await nextTick();
  const current = sidebar.value?.querySelector('[aria-current="page"], .sidebar-links a');
  (sidebar.value?.querySelector('[aria-current="page"]') || current)?.focus();
}
async function closeNavigation(restoreFocus = false) {
  menuOpen.value = false;
  if (restoreFocus) {
    await nextTick();
    menuTrigger.value?.focus();
  }
}
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
  catch {
    unreadCount.value = 0;
    recentNotifications.value = [];
    if (notificationsOpen.value) notificationError.value = 'Unable to load recent notifications.';
  }
}
watch(() => route.fullPath, () => {
  menuOpen.value = false;
  notificationsOpen.value = false;
  refreshUnread();
});
function onOutsideClick(event){if(notificationAnchor.value&&!notificationAnchor.value.contains(event.target))notificationsOpen.value=false;}
function onEscape(event) {
  if (event.defaultPrevented || event.key !== 'Escape') return;
  if (menuOpen.value) closeNavigation(true);
  else if (notificationsOpen.value) {
    notificationsOpen.value = false;
    notificationAnchor.value?.querySelector('button')?.focus();
  }
}
async function toggleNotifications(){notificationsOpen.value=!notificationsOpen.value;if(!notificationsOpen.value)return;notificationLoading.value=true;notificationError.value='';try{await refreshUnread();}finally{notificationLoading.value=false;}}
onMounted(()=>{compactQuery.addEventListener('change', syncViewport);refreshUnread();refreshProfile();document.addEventListener('pointerdown',onOutsideClick);document.addEventListener('keydown',onEscape);});
onUnmounted(()=>{compactQuery.removeEventListener('change', syncViewport);document.removeEventListener('pointerdown',onOutsideClick);document.removeEventListener('keydown',onEscape);});
const isLogin = computed(() => ['Login', 'Signup', 'VerifyEmail', 'ResendVerification', 'ForgotPassword', 'ResetPassword'].includes(route.name));
watch(isLogin, (isPublic, wasPublic) => {
  if (!isPublic && wasPublic) {
    profileData.value = readStoredProfile();
    applyStoredAppearance(profileData.value);
    refreshProfile();
  }
});
const currentRole = computed(() => {
  return profileData.value.role || 'MEMBER';
});
function isActive(item) {
  const base = item.to.startsWith('/admin/') ? '/admin' : item.to;
  return route.path === base || route.path.startsWith(base + '/');
}
const navigationGroups = computed(() => [
  { title: '', items: [workplaceHome] },
  ...allowedWorkplaceGroups(currentRole.value)
]);
const currentGroup = computed(() => workplaceGroups.find(group => group.items.some(isActive)));
const pageTitle = computed(() =>
  route.name === 'Workplace' ? workplaceHome.label :
  route.name === 'Notifications' ? 'Notification Center' :
  currentGroup.value?.items.find(isActive)?.label || 'PMO Portal'
);
const currentUser = computed(() => {
  return profileData.value.name || profileData.value.email || 'Signed in';
});
const userInitials = computed(() => currentUser.value.trim().split(/[\s@.]+/).slice(0,2).map(w => w.charAt(0).toUpperCase()).join('') || 'PM');
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
