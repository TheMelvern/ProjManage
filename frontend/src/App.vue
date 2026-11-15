<template>
  <div v-if="isLogin" class="app-shell-login"><router-view /></div>
  <div v-else class="app-shell">
    <aside class="app-sidebar" :class="{ 'sidebar-open': menuOpen }" aria-label="Primary navigation">
      <div class="app-brand"><span class="brand-symbol">P</span><span>PMO Portal</span></div>
      <p class="nav-category">WORKSPACE</p>
      <nav class="sidebar-links" aria-label="PMO modules">
        <router-link v-for="item in navigation" :key="item.to" :to="item.to"
          :aria-current="route.path === item.to ? 'page' : undefined" @click="menuOpen = false">
          <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-bottom"><small>Persistent PMO workspace</small></div>
    </aside>
    <div class="app-content">
      <header class="app-topbar">
        <button type="button" class="menu-toggle" @click="menuOpen = !menuOpen"
          :aria-expanded="menuOpen" aria-label="Toggle navigation">
          <span class="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <div class="topbar-label">{{ pageTitle }}</div>
        <div class="topbar-right">
          <span class="profile-badge" :title="currentUser">{{ userInitials }}</span><span class="user-label">{{ currentUser }}</span>
          <button type="button" class="logout-btn" @click="logout">Sign out</button>
        </div>
      </header>
      <router-view />
    </div>
    <button v-if="menuOpen" type="button" class="mobile-backdrop"
      aria-label="Close navigation" @click="menuOpen = false" />
  </div>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const navigation = [
  { to: '/portfolio', label: 'Portfolio Overview', icon: 'dashboard' },
  { to: '/approvals', label: 'Approval Center', icon: 'rule' },
  { to: '/workspace', label: 'Delivery Workspace', icon: 'task_alt' },
  { to: '/raid', label: 'RAID Register', icon: 'warning_amber' },
  { to: '/timesheets', label: 'Timesheets', icon: 'schedule' },
  { to: '/leave', label: 'Leave Tracker', icon: 'event_available' },
  { to: '/reports', label: 'Executive Reports', icon: 'summarize' },
  { to: '/admin/parameters', label: 'Admin Parameters', icon: 'settings' }
];
const isLogin = computed(() => ['Login', 'Signup'].includes(route.name));
const pageTitle = computed(() => navigation.find(item => item.to === route.path)?.label || 'PMO Portal');
const currentUser = computed(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    return stored.name || stored.email || 'Signed in';
  } catch { return 'Signed in'; }
});
const userInitials = computed(() => currentUser.value.split(/[\\s@.]+/).slice(0,2).map(w => w.charAt(0).toUpperCase()).join('') || 'PM');
function logout() {
  ['access_token', 'auth_token', 'auth-token', 'user'].forEach(key => localStorage.removeItem(key));
  menuOpen.value = false;
  router.replace({ name: 'Login' });
}
</script>
