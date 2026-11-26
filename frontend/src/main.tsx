import { useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createHashRouter, Navigate, Outlet, useBlocker, useLocation, useNavigate, useParams,
} from 'react-router';
import { RouterProvider } from 'react-router/dom';
import './styles/shared/tailwind.css';
import './styles/shared/app.css';
import './styles/shared/typography.css';
import './styles/shared/adaptive-premium.css';
import './styles/shared/product-design.css';
import './styles/shared/workplace-layout.css';
import { App, usePortalLink, usePortalProfile } from './App';
import { initializeAppearance } from './utils/appearance';
import { ModuleWorkspace } from './views/modules/ModuleWorkspace';
import { Login } from './views/modules/authentication/Login';
import { Signup } from './views/modules/authentication/Signup';
import { AccountAccess, type Mode } from './views/modules/authentication/AccountAccess';
import { DetailWorkspace, type DetailArea } from './views/modules/projects/DetailWorkspace';
import { ProjectCreate } from './views/modules/projects/ProjectCreate';
import { ProjectHub } from './views/modules/projects/ProjectHub';
import { NotificationCenter } from './views/modules/administration/NotificationCenter';
import { PortfolioOverview } from './views/modules/projects/pmoDashboard/PortfolioOverview';
import { MyWork } from './views/modules/MyWork';
import { DemoJourney } from './views/modules/DemoJourney';
import { WorkplaceHome } from './views/modules/WorkplaceHome';

function PublicLayout() {
  if (localStorage.getItem('access_token')) return <Navigate to="/portfolio" replace />;
  return <div className="app-shell-login"><Outlet /></div>;
}

function LoginRoute() {
  const link = usePortalLink();
  const navigate = useNavigate();
  return <Login link={link} afterSignIn={() => { void navigate('/portfolio', { replace: true }); }} />;
}

function SignupRoute() {
  return <Signup link={usePortalLink()} />;
}

function AccountRoute({ mode }: { mode: Mode }) {
  const link = usePortalLink();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return <AccountAccess key={mode} mode={mode} token={new URLSearchParams(search).get('token') ?? ''}
    link={link} removeToken={() => { void navigate(pathname, { replace: true }); }} />;
}

function ProjectCreateRoute() {
  const link = usePortalLink();
  const { search } = useLocation();
  const guard = useRef<(() => boolean) | undefined>(undefined);
  const setLeaveGuard = useCallback((value: (() => boolean) | undefined) => { guard.current = value; }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    Boolean(localStorage.getItem('access_token')) &&
    currentLocation.pathname !== nextLocation.pathname && guard.current?.() === false);
  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  return <ProjectCreate revise={new URLSearchParams(search).get('revise') ?? undefined} link={link} setLeaveGuard={setLeaveGuard} />;
}

function ProjectHubRoute() {
  const link = usePortalLink();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { pathname, search } = useLocation();
  const query = new URLSearchParams(search);
  return <ProjectHub key={id} projectId={id} viewQuery={query.get('view') ?? undefined}
    onlyOverdue={query.get('work') === 'overdue'} create={query.get('create') === '1'} link={link}
    patchQuery={updates => {
      for (const [key, value] of Object.entries(updates)) {
        if (value == null) query.delete(key);
        else query.set(key, value);
      }
      const next = query.toString();
      void navigate(pathname + (next ? '?' + next : ''), { replace: true });
    }} />;
}

function DetailRoute({ area }: { area: DetailArea }) {
  const { search } = useLocation();
  return <DetailWorkspace key={area} area={area} requestedProject={new URLSearchParams(search).get('projectId') ?? undefined}
    link={usePortalLink()} />;
}

function WorkplaceRoute() {
  const { role } = usePortalProfile();
  return <WorkplaceHome role={role || 'MEMBER'} link={usePortalLink()} />;
}

function PortfolioRoute() {
  const { role } = usePortalProfile();
  return <PortfolioOverview role={role} link={usePortalLink()} />;
}

function MyWorkRoute() {
  const link = usePortalLink();
  return <MyWork resolveLink={(path, scope) => link(path + '?scope=' + encodeURIComponent(scope))} />;
}

function DemoRoute() {
  return <DemoJourney link={usePortalLink()} />;
}

function NotificationRoute() {
  return <NotificationCenter link={usePortalLink()} />;
}

initializeAppearance();
const modules = ['projects', 'raid', 'timesheets', 'reports', 'leave', 'claims'] as const;
const aliases = {
  '/': '/workplace', '/approvals': '/projects/approvals', '/approvals/detail': '/projects/approvals',
  '/leave/records': '/leave', '/admin/hr': '/people/setup', '/admin': '/admin/parameters',
  '/admin/workflows': '/admin/parameters', '/admin/access': '/admin/users', '/workspace': '/projects',
};
const router = createHashRouter([
  { element: <PublicLayout />, children: [
    { path: '/login', element: <LoginRoute /> },
    { path: '/signup', element: <SignupRoute /> },
    { path: '/verify-email', element: <AccountRoute mode="verify" /> },
    { path: '/resend-verification', element: <AccountRoute mode="resend" /> },
    { path: '/forgot-password', element: <AccountRoute mode="forgot" /> },
    { path: '/reset-password', element: <AccountRoute mode="reset" /> },
  ] },
  { element: <App />, children: [
    ...Object.entries(aliases).map(([path, to]) => ({ path, element: <Navigate replace to={to} /> })),
    { path: '/notifications', element: <NotificationRoute /> },
    { path: '/workplace', element: <WorkplaceRoute /> },
    { path: '/my-work', element: <MyWorkRoute /> },
    { path: '/demo', element: <DemoRoute /> },
    { path: '/portfolio', element: <PortfolioRoute /> },
    { path: '/projects/new', element: <ProjectCreateRoute /> },
    { path: '/projects/:id/workspace', element: <ProjectHubRoute /> },
    { path: '/people/setup', element: <ModuleWorkspace module="hr" /> },
    { path: '/leave/team', element: <ModuleWorkspace module="leave" /> },
    { path: '/admin/parameters', element: <ModuleWorkspace module="admin" /> },
    { path: '/admin/users', element: <ModuleWorkspace module="admin" /> },
    { path: '/admin/audit', element: <ModuleWorkspace module="admin" /> },
    { path: '/admin/approvals/:requestId?', element: <ModuleWorkspace module="admin" /> },
    ...(['projects', 'raid', 'timesheets', 'reports'] as const).map(area => ({
      path: '/' + area + '/detail', element: <DetailRoute area={area} />,
    })),
    ...modules.flatMap(module => [
      { path: '/' + module, element: <ModuleWorkspace key={module} module={module} /> },
      { path: '/' + module + '/approvals/:requestId?', element: <ModuleWorkspace key={module} module={module} /> },
    ]),
    { path: '*', element: <Navigate replace to="/portfolio" /> },
  ] },
]);

const root = document.getElementById('app');
if (!root) throw new Error('Missing portal root');
createRoot(root).render(<RouterProvider router={router} />);
