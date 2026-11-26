import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { usePortalLink, usePortalProfile } from '../../App';
import { ReviewCenter, type ReviewModule } from './administration/ReviewCenter';
import { Parameters } from './administration/Parameters';
import { UserAdmin } from './administration/UserAdmin';
import { AuditLog } from './administration/AuditLog';
import { LeaveTracker } from './people/LeaveTracker';
import { TeamAvailability } from './people/TeamAvailability';
import { ClaimsWorkspace } from './people/ClaimsWorkspace';
import { ProjectWorkspace } from './projects/ProjectWorkspace';
import { RaidWorkspace } from './projects/RaidWorkspace';
import { TimesheetWorkspace } from './projects/TimesheetWorkspace';
import { ReportsView } from './projects/reports/ReportsView';
import './ModuleWorkspace.css';

const labels: Record<ReviewModule, string> = {
  admin: 'Administration', projects: 'Projects & Tasks', raid: 'RAID Register', timesheets: 'Timesheets',
  leave: 'Leave Tracker', claims: 'Claims', reports: 'Executive Reports',
};

export function ModuleWorkspace({ module }: { module: ReviewModule | 'hr' }) {
  const link = usePortalLink();
  const { role, id: userId } = usePortalProfile();
  const { pathname, search } = useLocation();
  const { requestId } = useParams();
  const navigate = useNavigate();
  const query = new URLSearchParams(search);
  const isAdmin = role === 'ADMIN';
  const calendarAllowed = ['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(role ?? '');
  const approval = pathname.split('/').includes('approvals');
  const section = approval ? 'approvals' : module === 'admin' ? pathname.split('/')[2] ?? 'parameters'
    : module === 'leave' && pathname === '/leave/team' ? 'calendar' : 'overview';
  const tabs = module === 'admin' ? [
    { key: 'parameters', label: 'Admin Parameters', to: '/admin/parameters' },
    { key: 'users', label: 'Users & Roles', to: '/admin/users' },
    { key: 'audit', label: 'Audit & Security', to: '/admin/audit' },
  ] : module === 'leave' ? [
    { key: 'overview', label: 'My leave', to: '/leave' },
    ...(calendarAllowed ? [{ key: 'calendar', label: 'Team calendar', to: '/leave/team' }] : []),
    { key: 'approvals', label: 'Approvals', to: '/leave/approvals' },
  ] : [
    { key: 'overview', label: 'Overview', to: '/' + module },
    { key: 'approvals', label: 'Approvals', to: '/' + module + '/approvals' },
  ];

  let content: ReactNode;
  if ((module === 'admin' || module === 'hr') && !isAdmin) {
    content = <section className="permission-explainer" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
      <h2>{module === 'hr' ? 'HR setup' : 'Parameters'}</h2><p>Administrator access is required to manage these settings.</p>
    </section>;
  } else if (module === 'hr') {
    content = <Parameters key="hr" hr />;
  } else if (approval) {
    content = <ReviewCenter key={module} module={module} requestedId={requestId} scopeQuery={query.get('scope') ?? undefined}
      userId={userId} role={role} link={link} requestLink={id => link('/' + module + '/approvals/' + encodeURIComponent(id) + search)} />;
  } else if (module === 'admin') {
    content = section === 'users' ? <UserAdmin /> : section === 'audit' ? <AuditLog reference={query.get('ref') ?? undefined} /> : <Parameters key="admin" />;
  } else if (module === 'leave') {
    content = section === 'calendar' ? <TeamAvailability /> : <LeaveTracker request={query.get('request') ?? undefined}
      revise={query.get('revise') ?? undefined} isAdmin={isAdmin} link={link} />;
  } else if (module === 'claims') {
    content = <ClaimsWorkspace request={query.get('request') ?? undefined} link={link} clearRequest={() => {
      if (!query.has('request')) return;
      query.delete('request');
      const next = query.toString();
      void navigate(pathname + (next ? '?' + next : ''), { replace: true });
    }} />;
  } else if (module === 'projects') {
    content = <ProjectWorkspace link={link} />;
  } else if (module === 'raid') {
    content = <RaidWorkspace requestedProject={query.get('projectId') ?? undefined} link={link} />;
  } else if (module === 'timesheets') {
    content = <TimesheetWorkspace requestedProject={query.get('projectId') ?? undefined} create={query.get('create') === '1'} link={link} />;
  } else {
    content = <ReportsView link={link} />;
  }

  return <div className="module-space">
    {module !== 'hr' && <nav className="module-tabs" aria-label={labels[module] + ' tabs'}>
      <div className="module-tabs-track">{tabs.map(tab => <a key={tab.to} href={link(tab.to)}
        className={section === tab.key ? 'selected' : undefined} aria-current={section === tab.key ? 'page' : undefined}>{tab.label}</a>)}</div>
    </nav>}
    {content}
  </div>;
}
