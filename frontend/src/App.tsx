import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Navigate, Outlet, useHref, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import api from './api/axiosConfig';
import { QuickCreate } from './components/QuickCreate';
import { WorkspaceSearch } from './components/WorkspaceSearch';
import { ProfileManagementModal, type Profile } from './views/modules/administration/ProfileManagementModal';
import { applyStoredAppearance, resetAppearance } from './utils/appearance';
import { allowedWorkplaceGroups, workplaceHome } from './workplaceNavigation';

const railIcons: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  work: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H9zM9 14l2 2 4-4',
  Delivery: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM9 5v14M15 5v14M5.5 9h1M11.5 9h1M17.5 9h1',
  People: 'M14 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4.5 19v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1M16.5 6.5a3 3 0 0 1 0 5.5M19 14.5a3.5 3.5 0 0 1 2 3.2V19',
  Administration: 'M4 6h5m4 0h7M4 12h10m4 0h2M4 18h2m4 0h10M9 4v4m5 2v4M6 16v4',
  signOut: 'M11 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5m-1-7h10m-4-4 4 4-4 4'
};

interface Inbox { unread: number; items: { id: string; title: string; body: string; createdAt: string; readAt?: string }[] }
const emptyInbox: Inbox = { unread: 0, items: [] };
const compactQuery = '(max-width: 900px), (hover: none), (pointer: coarse)';

export function usePortalProfile() {
  return useOutletContext<Profile>();
}

export function usePortalLink() {
  const root = useHref('/');
  const prefix = root.slice(0, -1);
  return useCallback((path: string) => prefix + path, [prefix]);
}

function readStoredProfile(): Profile {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); }
  catch { return {}; }
}

function RailIcon({ name }: { name: string }) {
  return <svg className="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={railIcons[name]} /></svg>;
}

export function App() {
  const route = useLocation();
  const authenticated = Boolean(localStorage.getItem('access_token'));
  if (!authenticated) return <Navigate replace to={'/login?redirect=' + encodeURIComponent(route.pathname + route.search + route.hash)} />;
  return <WorkspaceShell />;
}

function WorkspaceShell() {
  const route = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const link = usePortalLink();
  const routeKey = route.pathname + route.search + route.hash;
  const [compact, setCompact] = useState(() => window.matchMedia(compactQuery).matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState('');
  const [panelTop, setPanelTop] = useState(0);
  const [profile, setProfile] = useState(readStoredProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox>(emptyInbox);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const sidebar = useRef<HTMLElement>(null);
  const railPanel = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const notificationAnchor = useRef<HTMLDivElement>(null);
  const railAnchor = useRef<HTMLElement | null>(null);
  const focusRail = useRef(false);
  const lastPath = useRef(route.pathname);
  const role = profile.role || 'MEMBER';
  const userName = profile.name || profile.email || 'Signed in';
  const userInitials = userName.trim().split(/[\s@.]+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('') || 'PM';
  const rootLinks = [workplaceHome, { to: '/my-work', label: 'My work', icon: 'assignment_ind' }];
  const groups = allowedWorkplaceGroups(role);
  const navigationGroups = [{ title: '', items: rootLinks }, ...groups];
  const activeRailGroup = groups.find(group => group.title === openGroup);
  const projectId = route.pathname.endsWith('/workspace') ? params.id || route.pathname.match(/^\/projects\/([^/]+)\/workspace$/)?.[1] : undefined;

  const profileUpdated = useCallback((update: Profile) => {
    const next = { ...readStoredProfile(), ...update };
    localStorage.setItem('user', JSON.stringify(next));
    applyStoredAppearance(next);
    setProfile(next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(compactQuery);
    function changed(event: MediaQueryListEvent) {
      setCompact(event.matches);
      setOpenGroup('');
      if (!event.matches) setMenuOpen(false);
    }
    media.addEventListener('change', changed);
    const controller = new AbortController();
    applyStoredAppearance(readStoredProfile());
    void api.get<{ data: Profile }>('/profile', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) profileUpdated(data.data);
    }).catch(() => { /* Keep the cached profile if the API is unavailable. */ });
    return () => {
      controller.abort();
      media.removeEventListener('change', changed);
    };
  }, [profileUpdated]);

  useLayoutEffect(() => {
    if (menuOpen) (sidebar.current?.querySelector<HTMLElement>('[aria-current="page"]') ||
      sidebar.current?.querySelector<HTMLElement>('.sidebar-links a'))?.focus();
  }, [menuOpen]);

  useLayoutEffect(() => {
    const anchor = railAnchor.current;
    if (!openGroup || !anchor || !railPanel.current) return;
    setPanelTop(Math.max(0, Math.min(anchor.getBoundingClientRect().top, window.innerHeight - railPanel.current.offsetHeight)));
    if (focusRail.current) {
      focusRail.current = false;
      (railPanel.current.querySelector<HTMLElement>('[aria-current="page"]') || railPanel.current.querySelector('a'))?.focus();
    }
  }, [openGroup]);

  useLayoutEffect(() => {
    setOpenGroup('');
    setMenuOpen(false);
    setNotificationsOpen(false);
    if (lastPath.current !== route.pathname) {
      lastPath.current = route.pathname;
      window.scrollTo(0, 0);
      const heading = document.querySelector<HTMLElement>('.app-content main h1, .app-content .permission-explainer h2');
      if (heading && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }, [routeKey, route.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void api.get<{ data: Inbox }>('/notifications', { signal }).then(({ data }) => {
      if (!signal.aborted) setInbox({ unread: data.data.unread, items: data.data.items.slice(0, 5) });
    }).catch(() => { if (!signal.aborted) setInbox(emptyInbox); });
    return () => controller.abort();
  }, [routeKey]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const controller = new AbortController();
    const { signal } = controller;
    setNotificationLoading(true);
    setNotificationError('');
    void api.get<{ data: Inbox }>('/notifications', { signal }).then(({ data }) => {
      if (!signal.aborted) setInbox({ unread: data.data.unread, items: data.data.items.slice(0, 5) });
    }).catch(() => {
      if (signal.aborted) return;
      setInbox(emptyInbox);
      setNotificationError('Unable to load recent notifications.');
    }).finally(() => { if (!signal.aborted) setNotificationLoading(false); });
    return () => controller.abort();
  }, [notificationsOpen]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!sidebar.current?.contains(event.target)) setOpenGroup('');
      if (!notificationAnchor.current?.contains(event.target)) setNotificationsOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  function closeNavigation(restore = false) {
    setMenuOpen(false);
    if (restore) requestAnimationFrame(() => menuTrigger.current?.focus());
  }

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      if (menuOpen) closeNavigation(true);
      else if (openGroup) {
        setOpenGroup('');
        railAnchor.current?.focus();
      } else if (notificationsOpen) {
        setNotificationsOpen(false);
        notificationAnchor.current?.querySelector('button')?.focus();
      }
    }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [menuOpen, openGroup, notificationsOpen]);

  function showGroup(title: string, anchor: HTMLElement, focus: boolean) {
    railAnchor.current = anchor;
    if (openGroup === title && focus && railPanel.current) {
      (railPanel.current.querySelector<HTMLElement>('[aria-current="page"]') || railPanel.current.querySelector('a'))?.focus();
      return;
    }
    focusRail.current = focus;
    setOpenGroup(title);
  }

  function active(to: string) {
    return route.pathname === to || route.pathname.startsWith(to + '/') ||
      (to === '/admin/parameters' && ['/admin/users', '/admin/audit'].includes(route.pathname));
  }

  function clearSession() {
    ['access_token', 'auth_token', 'auth-token', 'user'].forEach(key => localStorage.removeItem(key));
    resetAppearance();
    setProfileOpen(false);
    void navigate('/login', { replace: true });
  }

  async function logout() {
    try { if (localStorage.getItem('access_token')) await api.post('/auth/logout'); }
    catch { /* Local sign-out is still available when the API is offline. */ }
    clearSession();
  }

  // Keep plain hash anchors usable as native links while routing ordinary clicks through the draft guard.
  function followLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download') || !anchor.hash.startsWith('#/') ||
      anchor.origin !== window.location.origin || anchor.pathname !== window.location.pathname || anchor.search !== window.location.search) return;
    event.preventDefault();
    void navigate(anchor.hash.slice(1));
  }

  return <div className={compact ? 'app-shell navigation-drawer' : 'app-shell'} onClick={followLink}>
    <aside id="workspace-navigation" ref={sidebar} inert={compact && !menuOpen}
      className={menuOpen ? 'app-sidebar sidebar-open' : 'app-sidebar'} aria-label="Primary navigation"
      onPointerLeave={() => { if (!railPanel.current?.contains(document.activeElement)) setOpenGroup(''); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenGroup(''); }}>
      <div className="app-brand"><span className="brand-symbol">P</span><span>PMO Portal</span>
        {compact && <button className="drawer-close" type="button" aria-label="Close navigation" onClick={() => closeNavigation(true)}>
          <span className="material-symbols-outlined" aria-hidden="true">close</span></button>}
      </div>
      {compact ? <nav className="sidebar-links" aria-label="PMO modules">
        {navigationGroups.map(group => <Fragment key={group.title}>
          {group.title && <p className="nav-category">{group.title}</p>}
          {group.items.map(item => <a key={item.to} href={link(item.to)} title={item.label}
            aria-current={active(item.to) ? 'page' : undefined} onClick={() => closeNavigation(route.pathname === item.to)}>
            <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><span className="sidebar-item-label">{item.label}</span>
          </a>)}
        </Fragment>)}
      </nav> : <nav className="sidebar-links sidebar-rail" aria-label="PMO modules">
        {rootLinks.map(item => <a key={item.to} href={link(item.to)} aria-label={item.label} aria-current={active(item.to) ? 'page' : undefined}
          onPointerEnter={() => setOpenGroup('')} onClick={() => setOpenGroup('')}>
          <RailIcon name={item.to === workplaceHome.to ? 'home' : 'work'} /><span>{item.to === workplaceHome.to ? 'Home' : 'My work'}</span>
        </a>)}
        {groups.map(group => <button key={group.title} type="button"
          className={group.items.some(item => active(item.to)) ? 'rail-group contains-current' : 'rail-group'}
          data-group={group.title} aria-label={group.title} aria-expanded={openGroup === group.title}
          aria-controls={openGroup === group.title ? 'workspace-section-links' : undefined}
          onPointerEnter={event => showGroup(group.title, event.currentTarget, false)}
          onClick={event => showGroup(group.title, event.currentTarget, true)}>
          <RailIcon name={group.title} /><span>{group.title === 'Administration' ? 'Admin' : group.title}</span>
        </button>)}
      </nav>}
      {!compact && activeRailGroup && <nav id="workspace-section-links" ref={railPanel} className="sidebar-panel"
        style={{ insetBlockStart: panelTop }} aria-label={activeRailGroup.title + ' navigation'}>
        <div className="sidebar-panel-surface">
          <p className="sidebar-panel-heading">{activeRailGroup.title}</p>
          <ul className="sidebar-panel-links">{activeRailGroup.items.map(item => <li key={item.to}>
            <a href={link(item.to)} aria-current={active(item.to) ? 'page' : undefined} onClick={() => {
              setOpenGroup('');
              if (route.pathname === item.to) railAnchor.current?.focus();
            }}>
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span className="sidebar-panel-label">{item.label}</span>
              {active(item.to) && <span className="sidebar-panel-indicator" aria-hidden="true" />}
            </a>
          </li>)}</ul>
        </div>
      </nav>}
      <div className="sidebar-bottom"><button type="button" className="sidebar-signout" title="Sign out" aria-label="Sign out" onClick={logout}>
        {compact ? <span className="material-symbols-outlined" aria-hidden="true">logout</span> : <RailIcon name="signOut" />}
        <span className="sidebar-item-label">Sign out</span>
      </button></div>
    </aside>
    <div className="app-content" inert={compact && menuOpen}>
      <header className="app-topbar">
        <button type="button" ref={menuTrigger} className="menu-toggle" aria-controls="workspace-navigation" aria-expanded={menuOpen}
          aria-label="Toggle navigation" onClick={() => setMenuOpen(true)}>
          <span className="material-symbols-outlined" aria-hidden="true">menu</span></button>
        <WorkspaceSearch key={'search-' + routeKey} groups={navigationGroups} link={link} navigate={path => { void navigate(path); }} />
        <div className="topbar-right">
          <QuickCreate key={'create-' + routeKey} role={role} projectId={projectId} link={link} />
          <div className="notification-anchor" ref={notificationAnchor}>
            <button type="button" className="notification-shortcut" title="Recent notifications" aria-label="Recent notifications"
              aria-expanded={notificationsOpen} aria-haspopup="dialog" onClick={() => setNotificationsOpen(current => !current)}>
              <svg className="topbar-notification-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 17.5h15l-1.5-2.2V10a6 6 0 0 0-12 0v5.3zM10 20a2 2 0 0 0 4 0" />
              </svg>
              {inbox.unread > 0 && <span className="notification-count">{inbox.unread > 99 ? '99+' : inbox.unread}</span>}
            </button>
            {notificationsOpen && <section className="notification-popover" role="dialog" aria-label="Recent notifications">
              <div className="notification-popover-head"><strong>Recent activity</strong><span>{inbox.unread} unread</span></div>
              {notificationError ? <p className="notification-popover-error" role="alert">{notificationError}</p>
                : notificationLoading ? <p className="notification-popover-empty">Loading updates…</p>
                : inbox.items.length === 0 ? <p className="notification-popover-empty">No notifications yet.</p>
                : <div className="notification-popover-list">{inbox.items.map(item => <article key={item.id}
                  className={item.readAt ? 'notification-popover-item' : 'notification-popover-item unread'}>
                  <strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small>
                </article>)}</div>}
              <a className="notification-view-all" href={link('/notifications')} onClick={() => setNotificationsOpen(false)}>View details · Notification Center</a>
            </section>}
          </div>
          <button type="button" className="profile-badge profile-badge-button" title={userName}
            aria-label={'Manage profile for ' + userName} onClick={() => setProfileOpen(true)}>
            {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" className="topbar-avatar-image" />
              : <span className="topbar-avatar-initials" aria-hidden="true">{userInitials}</span>}
          </button>
        </div>
      </header>
      <Outlet context={profile} />
    </div>
    {profileOpen && <ProfileManagementModal onClose={() => setProfileOpen(false)} onUpdated={profileUpdated} onPasswordChanged={clearSession} />}
    {compact && menuOpen && <div className="mobile-backdrop" aria-hidden="true" onClick={() => closeNavigation(true)} />}
  </div>;
}
