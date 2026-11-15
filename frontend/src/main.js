import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Login from './views/modules/authentication/Login.vue';
import Signup from './views/modules/authentication/Signup.vue';
import ReviewCenter from './views/modules/administration/ReviewCenter.vue';
import LeaveTracker from './views/modules/people/LeaveTracker.vue';
import Parameters from './views/modules/administration/Parameters.vue';
import UserAdmin from './views/modules/administration/UserAdmin.vue';
import AuditLog from './views/modules/administration/AuditLog.vue';
import TeamAvailability from './views/modules/people/TeamAvailability.vue';
import DetailWorkspace from './views/modules/projects/DetailWorkspace.vue';
import ConnectedWorkflows from './views/modules/administration/ConnectedWorkflows.vue';
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
    { path: '/approvals/detail', name: 'ApprovalDetail', component: ReviewCenter },
    { path: '/workflows', name: 'ConnectedWorkflows', component: ConnectedWorkflows },
    { path: '/leave', name: 'Leave', component: LeaveTracker },
    { path: '/leave/records', name: 'LeaveRecords', component: LeaveTracker },
    { path: '/leave/approvals', name: 'LeaveApprovals', component: TeamAvailability },
    { path: '/admin/parameters', name: 'Parameters', component: Parameters },
    { path: '/admin', redirect: '/admin/parameters' },
    { path: '/admin/workflows', name: 'AdminWorkflows', component: Parameters },
    { path: '/admin/users', name: 'UserAdmin', component: UserAdmin },
    { path: '/admin/access', name: 'AdminAccess', component: UserAdmin },
    { path: '/admin/audit', name: 'AuditLog', component: AuditLog },
    { path: '/leave/team', name: 'TeamAvailability', component: TeamAvailability },
    { path: '/', redirect: '/portfolio' },
    { path: '/portfolio', name: 'Portfolio', component: PortfolioOverview },
    { path: '/workspace', name: 'Workspace', component: ProjectWorkspace },
    { path: '/projects', name: 'Projects', component: ProjectWorkspace },
    { path: '/projects/detail', name: 'ProjectDetail', component: DetailWorkspace },
    { path: '/raid/detail', name: 'RaidDetail', component: DetailWorkspace },
    { path: '/timesheets/detail', name: 'TimesheetDetail', component: DetailWorkspace },
    { path: '/reports/detail', name: 'ReportDetail', component: DetailWorkspace },
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
