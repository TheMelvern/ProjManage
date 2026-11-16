<template>
  <div v-if="isLogin" class="app-shell-login"><router-view /></div>
  <div v-else class="app-shell">
    <aside class="app-sidebar" :class="{ 'sidebar-open': menuOpen }" aria-label="Primary navigation">
      <div class="app-brand"><span class="brand-symbol">P</span><span>PMO Portal</span></div>
      <p class="nav-category">WORKSPACE</p>
      <nav class="sidebar-links" aria-label="PMO modules">
        <router-link v-for="item in visibleNavigation" :key="item.to" :to="item.to"
          :aria-current="route.path === item.to ? 'page' : undefined" @click="menuOpen = false">
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
          <router-link to="/notifications" class="notification-shortcut" title="Notification Center" aria-label="Notification Center"><span class="material-symbols-outlined">notifications</span><span v-if="unreadCount" class="notification-count">{{ unreadCount > 99 ? "99+" : unreadCount }}</span></router-link>
          <span class="profile-badge" :title="currentUser" :aria-label="'Signed in as ' + currentUser">{{ userInitials }}</span>
        </div>
      </header>
      <router-view />
    </div>
    <button v-if="menuOpen" type="button" class="mobile-backdrop"
      aria-label="Close navigation" @click="menuOpen = false" />
  </div>
</template>
<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axiosInstance from './api/axiosConfig';
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const unreadCount = ref(0);
async function refreshUnread(){
  if (!localStorage.getItem('access_token')) { unreadCount.value=0; return; }
  try { const result = await axiosInstance.get('/notifications'); unreadCount.value=result.data.data.unread; }
  catch { unreadCount.value=0; }
}
watch(()=>route.fullPath, refreshUnread);
onMounted(refreshUnread);
const navigation = [
  { to: '/portfolio', label: 'Portfolio Overview', icon: 'dashboard' },
  { to: '/approvals', label: 'Approval Center', icon: 'rule' },
  { to: '/projects', label: 'Projects & Tasks', icon: 'task_alt' },
  { to: '/raid', label: 'RAID Register', icon: 'warning_amber' },
  { to: '/timesheets', label: 'Timesheets', icon: 'schedule' },
  { to: '/leave', label: 'Leave Tracker', icon: 'event_available' },
  { to: '/leave/team', label: 'Team Calendar', icon: 'calendar_month', managerOnly: true },
  { to: '/reports', label: 'Executive Reports', icon: 'summarize' },
  { to: '/admin/parameters', label: 'Admin Parameters', icon: 'settings', adminOnly: true },
  { to: '/admin/users', label: 'Users & Roles', icon: 'manage_accounts', adminOnly: true },
  { to: '/admin/audit', label: 'Audit & Security', icon: 'shield', adminOnly: true }
];
const isLogin = computed(() => ['Login', 'Signup', 'VerifyEmail', 'ResendVerification', 'ForgotPassword', 'ResetPassword'].includes(route.name));
const currentRole = computed(() => {
  route.path;
  try { return JSON.parse(localStorage.getItem('user') || '{}').role || 'MEMBER'; }
  catch { return 'MEMBER'; }
});
const visibleNavigation = computed(() => navigation.filter(item =>
  (!item.adminOnly || currentRole.value === 'ADMIN') &&
  (!item.managerOnly || ['ADMIN','PMO','PROJECT_MANAGER'].includes(currentRole.value))));

const pageTitle = computed(() =>
  route.path === '/notifications' ? 'Notification Center' :
  navigation.find(item => item.to === route.path)?.label || 'PMO Portal'
);
const currentUser = computed(() => {
  route.path;
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    return stored.name || stored.email || 'Signed in';
  } catch { return 'Signed in'; }
});
const userInitials = computed(() => currentUser.value.split(/[\\s@.]+/).slice(0,2).map(w => w.charAt(0).toUpperCase()).join('') || 'PM');
async function logout() {
  try {
    if (localStorage.getItem('access_token')) await axiosInstance.post('/auth/logout');
  } catch {
    // Local sign-out must still clear the browser token if the API is offline.
  }
  ['access_token', 'auth_token', 'auth-token', 'user'].forEach(key => localStorage.removeItem(key));
  menuOpen.value = false;
  unreadCount.value = 0;
  router.replace({ name: 'Login' });
}
</script>
