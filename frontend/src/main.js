import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Login from './views/modules/authentication/Login.vue';
import Signup from './views/modules/authentication/Signup.vue';
import ReviewCenter from './views/modules/administration/ReviewCenter.vue';
import PortfolioOverview from './views/modules/projects/pmoDashboard/PortfolioOverview.vue';
import ProjectWorkspace from './views/modules/projects/ProjectWorkspace.vue';
import RaidWorkspace from './views/modules/projects/RaidWorkspace.vue';
import TimesheetWorkspace from './views/modules/projects/TimesheetWorkspace.vue';
import ReportsView from './views/modules/projects/reports/ReportsView.vue';
import './styles/shared/tailwind.css';
import './styles/shared/app.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'Login', component: Login, meta: { public: true } },
    { path: '/signup', name: 'Signup', component: Signup, meta: { public: true } },
    { path: '/approvals', name: 'Approvals', component: ReviewCenter },
    { path: '/', redirect: '/portfolio' },
    { path: '/portfolio', name: 'Portfolio', component: PortfolioOverview },
    { path: '/workspace', name: 'Workspace', component: ProjectWorkspace },
    { path: '/raid', name: 'RAID', component: RaidWorkspace },
    { path: '/timesheets', name: 'Timesheets', component: TimesheetWorkspace },
    { path: '/reports', name: 'Reports', component: ReportsView },
    { path: '/:pathMatch(.*)*', redirect: '/portfolio' }
  ]
});

router.beforeEach((to) => {
  const hasToken = Boolean(localStorage.getItem('access_token'));
  if (!to.meta.public && !hasToken) {
    return { name: 'Login', query: { redirect: to.fullPath } };
  }
  if (['Login', 'Signup'].includes(to.name) && hasToken) return { name: 'Portfolio' };
  return true;
});

createApp(App).use(router).mount('#app');
