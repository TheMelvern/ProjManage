import { allowedWorkplaceGroups } from '../../workplaceNavigation';
import './WorkplaceHome.css';

const shortcutLabels = new Map([
  ['/portfolio', 'Portfolio'],
  ['/projects', 'Projects'],
  ['/timesheets', 'Timesheets'],
  ['/leave', 'Leave'],
]);

interface Props {
  role?: string;
  link: (path: string) => string;
}

export function WorkplaceHome({ role, link }: Props) {
  const groups = allowedWorkplaceGroups(role);
  const shortcuts = groups.flatMap(group => group.items).flatMap(item => {
    const label = shortcutLabels.get(item.to);
    return label ? [{ ...item, label }] : [];
  });
  shortcuts.push({ to: '/notifications', label: 'Notifications', icon: 'notifications' });

  return (
    <main className="workplace-home">
      <header className="workplace-intro">
        <h1>Workplace</h1>
        <p>Projects, people and approvals in one place.</p>
      </header>

      <nav className="destination-shelf" aria-label="Workspace shortcuts">
        {shortcuts.map(item => (
          <a key={item.to} href={link(item.to)}>
            <span className="destination-icon material-symbols-outlined" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <section className="workplace-next" aria-label="Next steps">
        <a className="pmo-control quiet" href={link('/my-work')}>Open my work</a>
        <a className="pmo-control quiet" href={link('/demo')}>Explore sample workflow</a>
      </section>
      {role === 'ADMIN' && (
        <details className="workplace-setup">
          <summary>Set up your workspace</summary>
          <ol>
            <li><a href={link('/admin/users')}>Review users and checker access</a></li>
            <li><a href={link('/projects/new')}>Submit your first project</a></li>
            <li><a href={link('/projects/approvals')}>Track independent approval</a></li>
          </ol>
        </details>
      )}

      <section className="workplace-section" aria-labelledby="workspace-areas">
        <h2 id="workspace-areas">Explore your workspace</h2>
        <div className="area-grid">
          {groups.map(group => (
            <section key={group.title} className={group.title === 'Delivery' ? 'area-card area-card-main' : 'area-card'}>
              <div className="area-intro">
                <span className="destination-icon material-symbols-outlined" aria-hidden="true">{group.icon}</span>
                <h3>{group.title}</h3>
                <p>{group.description}</p>
              </div>
              <ul className="area-links">
                {group.items.map(item => (
                  <li key={item.to}>
                    <a href={link(item.to)}>
                      <span>{item.label}</span>
                      <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="area-card inbox-card">
            <div className="area-intro">
              <span className="destination-icon material-symbols-outlined" aria-hidden="true">notifications</span>
              <h3>Notification inbox</h3>
              <p>Check approval requests and decisions addressed to you.</p>
            </div>
            <a className="pmo-control quiet" href={link('/notifications')}>Open notification inbox</a>
          </section>
        </div>
      </section>
    </main>
  );
}
