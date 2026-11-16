import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Login from './views/modules/authentication/Login.vue';
import Signup from './views/modules/authentication/Signup.vue';
import AccountAccess from './views/modules/authentication/AccountAccess.vue';
import LeaveRecords from './views/modules/people/LeaveRecords.vue';
import DetailWorkspace from './views/modules/projects/DetailWorkspace.vue';
import ProjectCreate from './views/modules/projects/ProjectCreate.vue';
import ProjectHub from './views/modules/projects/ProjectHub.vue';
import NotificationCenter from './views/modules/administration/NotificationCenter.vue';
import PortfolioOverview from './views/modules/projects/pmoDashboard/PortfolioOverview.vue';
import ModuleWorkspace from './views/modules/ModuleWorkspace.vue';
import './styles/shared/tailwind.css';
import './styles/shared/app.css';
import './styles/shared/typography.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'Login', component: Login, meta: { public: true } },
    { path: '/signup', name: 'Signup', component: Signup, meta: { public: true } },
    { path: '/verify-email', name: 'VerifyEmail', component: AccountAccess, meta: { public: true } },
    { path: '/resend-verification', name: 'ResendVerification', component: AccountAccess, meta: { public: true } },
    { path: '/forgot-password', name: 'ForgotPassword', component: AccountAccess, meta: { public: true } },
    { path: '/reset-password', name: 'ResetPassword', component: AccountAccess, meta: { public: true } },
    { path: '/notifications', name: 'Notifications', component: NotificationCenter },
    { path: '/approvals', redirect: '/projects/approvals' },
    { path: '/approvals/detail', redirect: '/projects/approvals' },
    { path: '/leave', name: 'Leave', component: ModuleWorkspace, props: {module:'leave'} },
    { path: '/leave/approvals', name: 'LeaveApprovals', component: ModuleWorkspace, props: {module:'leave'} },
    { path: '/leave/records', name: 'LeaveRecords', component: LeaveRecords },

    { path: '/admin/parameters', name: 'Parameters', component: ModuleWorkspace, props: {module:'admin'} },
    { path: '/admin/approvals', name: 'AdminApprovals', component: ModuleWorkspace, props: {module:'admin'} },
    { path: '/admin', redirect: '/admin/parameters' },
    { path: '/admin/workflows', redirect: '/admin/parameters' },
    { path: '/admin/users', name: 'UserAdmin', component: ModuleWorkspace, props: {module:'admin'} },
    { path: '/admin/access', redirect: '/admin/users' },
    { path: '/admin/audit', name: 'AuditLog', component: ModuleWorkspace, props: {module:'admin'} },
    { path: '/leave/team', name: 'TeamAvailability', component: ModuleWorkspace, props: {module:'leave'} },
    { path: '/', redirect: '/portfolio' },
    { path: '/portfolio', name: 'Portfolio', component: PortfolioOverview },
    { path: '/workspace', redirect: '/projects' },
    { path: '/projects', name: 'Projects', component: ModuleWorkspace, props: {module:'projects'} },
    { path: '/projects/new', name: 'ProjectCreate', component: ProjectCreate },
    { path: '/projects/:id/workspace', name: 'ProjectHub', component: ProjectHub },
    { path: '/projects/approvals', name: 'ProjectApprovals', component: ModuleWorkspace, props: {module:'projects'} },
    { path: '/projects/detail', name: 'ProjectDetail', component: DetailWorkspace },
    { path: '/raid/detail', name: 'RaidDetail', component: DetailWorkspace },
    { path: '/timesheets/detail', name: 'TimesheetDetail', component: DetailWorkspace },
    { path: '/reports/detail', name: 'ReportDetail', component: DetailWorkspace },
    { path: '/raid', name: 'RAID', component: ModuleWorkspace, props: {module:'raid'} },
    { path: '/raid/approvals', name: 'RaidApprovals', component: ModuleWorkspace, props: {module:'raid'} },
    { path: '/timesheets', name: 'Timesheets', component: ModuleWorkspace, props: {module:'timesheets'} },
    { path: '/timesheets/approvals', name: 'TimesheetApprovals', component: ModuleWorkspace, props: {module:'timesheets'} },
    { path: '/reports', name: 'Reports', component: ModuleWorkspace, props: {module:'reports'} },
    { path: '/reports/approvals', name: 'ReportApprovals', component: ModuleWorkspace, props: {module:'reports'} },
    { path: '/:pathMatch(.*)*', redirect: '/portfolio' }
  ]
});

router.beforeEach((to) => {
  const hasToken = Boolean(localStorage.getItem('access_token'));
  if (!to.meta.public && !hasToken) {
    return { name: 'Login', query: { redirect: to.fullPath } };
  }
  if (['Login', 'Signup', 'VerifyEmail', 'ResendVerification', 'ForgotPassword', 'ResetPassword'].includes(to.name) && hasToken) return { name: 'Portfolio' };
  return true;
});

createApp(App).use(router).mount('#app');
