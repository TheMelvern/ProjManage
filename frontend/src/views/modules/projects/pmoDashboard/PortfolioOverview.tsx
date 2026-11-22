import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../../api/axiosConfig';
import './PortfolioOverview.css';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const healthOptions = [
  { label: 'Active projects', tone: 'blue', health: '' },
  { label: 'On track', tone: 'green', health: 'GREEN' },
  { label: 'At risk', tone: 'amber', health: 'AMBER' },
  { label: 'Critical', tone: 'red', health: 'RED' },
];
interface Project {
  id: string;
  name: string;
  client?: string;
  health: string;
  progressPercent: number;
  overdueTasks: number;
  openRisks?: number;
  highRisks: number;
  openIssues: number;
}
interface Portfolio {
  generatedAt?: string;
  summary?: { activeProjects?: number };
  projects?: Project[];
}
function healthLabel(health: string) {
  return healthOptions.find(item => item.health === health && health)?.label ?? 'Unrated';
}
function projectLink(id: string) {
  return '/projects/' + encodeURIComponent(id) + '/workspace';
}
function rankPriorities(projects: Project[]) {
  const ranked = projects
    .filter(project => project.overdueTasks > 0 || project.highRisks > 0 ||
      project.openIssues > 0 || ['AMBER', 'RED'].includes(project.health))
    .map(project => ({
      id: project.id,
      health: project.health,
      order: project.health === 'RED' || project.highRisks > 0 ? 0 :
        project.overdueTasks > 0 || project.openIssues > 0 ? 1 : 2,
      title: project.highRisks > 0
        ? 'Mitigate ' + project.highRisks + ' high-severity risk' + (project.highRisks === 1 ? '' : 's')
        : project.overdueTasks > 0
          ? 'Resolve ' + project.overdueTasks + ' overdue task' + (project.overdueTasks === 1 ? '' : 's')
          : project.openIssues > 0
            ? 'Resolve ' + project.openIssues + ' open issue' + (project.openIssues === 1 ? '' : 's')
            : 'Review project health',
      subtitle: project.name,
      overdue: !project.highRisks && project.overdueTasks > 0
    }))
    .sort((a, b) => a.order - b.order);
  return ranked.slice(0, 4);
}

export function PortfolioOverview({ role, link }: { role?: string; link: (path: string) => string }) {
  const [report, setReport] = useState<Portfolio | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(liveMode);
  const [error, setError] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const canCreateProject = ['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(role ?? '');
  const projects = report?.projects ?? [];
  const visibleProjects = healthFilter ? projects.filter(project => project.health === healthFilter) : projects;
  const priorities = rankPriorities(projects);
  const generatedAt = report?.generatedAt;
  const date = generatedAt ? new Date(generatedAt) : undefined;
  const updated = date && new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError('');
    void api.get<{ data: Portfolio }>('/reports/portfolio', { signal }).then(({ data }) => {
      if (!signal.aborted) setReport(data.data);
    }).catch(failure => {
      if (signal.aborted) return;
      const message = isAxiosError<{ message?: string }>(failure) ? failure.response?.data?.message : undefined;
      setError(message || 'Unable to retrieve portfolio data. Check your session and API.');
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [revision]);

  return (
    <main className="portfolio-page">
      <header className="portfolio-header">
        <div><h1>Portfolio Overview</h1><p>Project health, delivery progress and executive priorities.</p></div>
        <div className="header-actions">
          {date && <time className="portfolio-date" dateTime={generatedAt} title={date.toLocaleString()}>Updated {updated}</time>}
          <button type="button" className="pmo-control quiet" disabled={loading} onClick={() => setRevision(current => current + 1)}>
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>Refresh
          </button>
        </div>
      </header>
      {!liveMode ? <p className="portfolio-message" role="status">Connect your local API and enable VITE_USE_LIVE_API=true to see real portfolio data.</p>
        : loading ? <p className="portfolio-message" role="status">{report ? 'Refreshing portfolio…' : 'Loading portfolio metrics…'}</p>
        : error && <p className="portfolio-message error" role="alert">{error} {report && 'Showing the last available portfolio.'}</p>}
      {report && (projects.length === 0 ? <section className="portfolio-onboarding">
        <span className="record-icon material-symbols-outlined" aria-hidden="true">folder_open</span>
        <div className="portfolio-start-copy">
          <h2>No active projects yet</h2><p>Approved projects appear here with delivery health and progress.</p>
          <div className="work-actions">
            {canCreateProject && <a className="pmo-control primary" href={link('/projects/new')}>Create project</a>}
            <a className={canCreateProject ? 'pmo-control quiet' : 'pmo-control primary'} href={link('/projects')}>View projects and requests</a>
          </div>
        </div>
      </section> : <>
        {priorities.length > 0 && <section className="portfolio-panel portfolio-attention">
          <div className="panel-heading"><h2>Needs attention</h2><p>Highest-priority items across your portfolio</p></div>
          <ol className="priority-list">{priorities.map(item => <li key={item.id}>
            <a className="portfolio-priority-link" href={link(projectLink(item.id) + (item.overdue ? '?view=backlog&work=overdue' : ''))}>
              <span className="record-state" data-state={item.health}>{healthLabel(item.health)}</span>
              <strong>{item.title}</strong><small>{item.subtitle}</small>
            </a>
          </li>)}</ol>
        </section>}
        <section className="portfolio-kpis" aria-label="Portfolio metrics">
          {healthOptions.map(item => <button key={item.label} className="kpi-card portfolio-filter" type="button"
            aria-pressed={healthFilter === item.health} onClick={() => setHealthFilter(healthFilter === item.health ? '' : item.health)}>
            <span>{item.label}</span>
            <strong className={item.tone}>{item.health ? projects.filter(project => project.health === item.health).length : report.summary?.activeProjects ?? '—'}</strong>
            <small>{item.health ? 'Of ' + projects.length + ' active projects' : 'All project health statuses'}</small>
          </button>)}
        </section>
        <section className="portfolio-panel portfolio-health">
          <div className="panel-heading"><h2>Portfolio health</h2><p>{healthFilter
            ? visibleProjects.length + ' of ' + projects.length + ' projects · ' + healthLabel(healthFilter)
            : 'Open a project to inspect delivery health and outstanding work.'}</p></div>
          <div className="portfolio-table-wrap" tabIndex={0} role="region" aria-label="Portfolio health table">
            <table>
              <thead><tr>{['Project', 'Health', 'Progress', 'Overdue', 'Open risks'].map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
              <tbody>{visibleProjects.map(project => <tr key={project.id}>
                <td><a className="queue-record" href={link(projectLink(project.id))}>{project.name}</a>{project.client && <small>{project.client}</small>}</td>
                <td><span className="record-state" data-state={project.health}>{healthLabel(project.health)}</span></td>
                <td><div className="portfolio-progress"><progress value={project.progressPercent} max={100} aria-label={'Progress for ' + project.name} /><span>{project.progressPercent}%</span></div></td>
                <td>{project.overdueTasks}</td><td>{project.openRisks ?? 0}</td>
              </tr>)}
                {visibleProjects.length === 0 && <tr><td colSpan={5} className="empty-cell">No projects match this status.</td></tr>}
              </tbody>
            </table>
          </div>
          <a className="panel-link" href={link('/reports')}>View executive reports</a>
        </section>
      </>)}
    </main>
  );
}
