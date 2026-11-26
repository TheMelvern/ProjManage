import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { SmartSelect } from '../../../components/SmartSelect';
import './DetailWorkspace.css';

const copy = {
  projects: ['Project Delivery Details', 'Project information, delivery status and task lifecycle.', 'Back to projects'],
  raid: ['RAID Register Details', 'Review risk, issue, decision and action details.', 'Back to RAID register'],
  timesheets: ['Project Timesheet History', 'Approved project work effort and history.', 'Back to timesheets'],
  reports: ['Executive Project Report', 'Project-level health, progress and overdue delivery.', 'Back to executive reports'],
};
export type DetailArea = keyof typeof copy;
const tabs = ['risks', 'issues', 'decisions', 'actions'] as const;
type RaidTab = typeof tabs[number];
interface Project { id: string; name: string; client?: string; description?: string; status: string; health: string }
interface Task { id: string; title: string; dueDate?: string; status: string }
interface RaidItem { id: string; title: string; status?: string; severity?: string; ownerName?: string; mitigation?: string; resolution?: string }
type Register = Partial<Record<RaidTab, RaidItem[]>>;
interface Entry { id: string; workDate: string; hours: number; description?: string; userName?: string }
interface Report { health: string; status: string; progressPercent: number; taskCounts: { overdue: number }; overdueTasks: Task[] }
const blankProject = { name: '', client: '', description: '', status: '', health: '' };
const blankRaid = { title: '', status: 'OPEN', severity: 'MEDIUM', ownerName: '', mitigation: '', resolution: '' };
const statuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const health = ['UNKNOWN', 'GREEN', 'AMBER', 'RED'];
const raidStatuses = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const amendments = { risks: 'RISK_UPDATE', issues: 'ISSUE_UPDATE', actions: 'ACTION_UPDATE' };

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '\u2014';
}

function describe(error: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(error) ? error.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (error instanceof Error ? error.message : 'Unable to load records');
}

export function DetailWorkspace({ area, requestedProject, link }: {
  area: DetailArea; requestedProject?: string; link: (path: string) => string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [register, setRegister] = useState<Register>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [raidTab, setRaidTab] = useState<RaidTab>('risks');
  const [selected, setSelected] = useState<RaidItem | null>(null);
  const [projectDraft, setProjectDraft] = useState(blankProject);
  const [raidDraft, setRaidDraft] = useState(blankRaid);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const [heading, intro, defaultBack] = copy[area];
  const context = projectId ? '?projectId=' + encodeURIComponent(projectId) : '';
  const backToHub = area === 'projects' && Boolean(projectId);
  const approvalPath = '/' + area + '/approvals';
  const visibleRecords = register[raidTab] ?? [];

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoadingProjects(true);
    setError('');
    void api.get<{ data: Project[] }>('/projects', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      setProjects(data.data);
      setProjectId(data.data.find(item => item.id === requestedProject)?.id ?? data.data[0]?.id ?? '');
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setLoadingProjects(false); });
    return () => controller.abort();
  }, [requestedProject]);

  useEffect(() => {
    setProject(null);
    setSelected(null);
    setTasks([]);
    setRegister({});
    setEntries([]);
    setReport(null);
    if (!projectId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const projectPath = '/projects/' + encodeURIComponent(projectId);
    setLoading(true);
    setError('');
    async function load() {
      try {
        const response = await api.get<{ data: Project }>(projectPath, { signal });
        if (signal.aborted) return;
        const record = response.data.data;
        setProject(record);
        setProjectDraft({ name: record.name, client: record.client || '', description: record.description || '', status: record.status, health: record.health });
        if (area === 'projects') {
          const { data } = await api.get<{ data: Task[] }>(projectPath + '/tasks', { signal });
          if (!signal.aborted) setTasks(data.data);
        } else if (area === 'raid') {
          const { data } = await api.get<{ data: Register }>(projectPath + '/raid', { signal });
          if (!signal.aborted) setRegister(data.data);
        } else if (area === 'timesheets') {
          const { data } = await api.get<{ data: Entry[] }>(projectPath + '/timesheets', { signal });
          if (!signal.aborted) setEntries(data.data);
        } else {
          const { data } = await api.get<{ data: Report }>('/reports/projects/' + encodeURIComponent(projectId), { signal });
          if (!signal.aborted) setReport(data.data);
        }
      } catch (failure) {
        if (!signal.aborted) setError(describe(failure));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [projectId, area]);

  function updateProject(key: keyof typeof blankProject, value: string) {
    setProjectDraft(current => ({ ...current, [key]: value }));
  }
  function updateRaid(key: keyof typeof blankRaid, value: string) {
    setRaidDraft(current => ({ ...current, [key]: value }));
  }
  function selectItem(item: RaidItem) {
    setSelected(item);
    setRaidDraft({
      title: item.title, status: item.status || 'OPEN', severity: item.severity || 'MEDIUM',
      ownerName: item.ownerName || '', mitigation: item.mitigation || '', resolution: item.resolution || '',
    });
  }
  async function propose(endpoint: string, values: object, message: string) {
    if (!projectId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(endpoint, { projectId, ...values });
      setNotice(message);
    } catch (failure) {
      setError(describe(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { name, client, description, status, health } = projectDraft;
    if (name.trim().length < 2) return;
    void propose('/reviews/projects', {
      name: name.trim(), client: client.trim(), description: description.trim(), status, health,
      summary: 'Approve project configuration changes for ' + name.trim(),
    }, 'Proposed project edits are awaiting an independent checker.');
  }
  function saveRaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || raidTab === 'decisions' || raidDraft.title.trim().length < 2) return;
    const { title, status, ownerName, severity, mitigation, resolution } = raidDraft;
    const values = {
      title: title.trim(), status, ownerName: ownerName.trim(),
      ...(raidTab === 'risks' ? { severity, mitigation: mitigation.trim() } : {}),
      ...(raidTab === 'issues' ? { severity, resolution: resolution.trim() } : {}),
    };
    void propose('/reviews/operations', {
      kind: amendments[raidTab], targetId: selected.id, values,
      summary: 'Review ' + raidTab + ' item ' + selected.title,
    }, 'RAID amendment submitted for independent approval.');
  }
  function proposeTask(task: Task) {
    const status = task.status === 'DONE' ? 'IN_PROGRESS' : 'DONE';
    void propose('/reviews/operations', { kind: 'TASK_UPDATE', targetId: task.id,
      summary: 'Change task ' + task.title + ' to ' + status, values: { status } }, 'Task status submitted to the checker queue.');
  }

  return (
    <main className="detail-screen operational-page">
      <header className="detail-header operational-heading">
        <div><p className="eyebrow">PMO OPERATIONS / {area.toUpperCase()}</p><h1>{heading}</h1><p>{intro}</p></div>
        <a className="pmo-control quiet" href={link(backToHub ? '/projects/' + encodeURIComponent(projectId) + '/workspace' : '/' + area + context)}>
          {backToHub ? 'Back to project workspace' : defaultBack}
        </a>
      </header>
      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message" role="status">{notice}</p>}
      {projects.length > 0 && <section className="card project-select">
        <label htmlFor="detail-project">Project</label>
        <SmartSelect id="detail-project" modelValue={projectId} ariaLabel="Project" disabled={busy}
          options={[{ value: '', label: 'Select project' }, ...projects.map(item => ({ value: item.id, label: item.name }))]}
          onChange={value => setProjectId(String(value))} />
        <a className="link" href={link(approvalPath)}>Open approval queue</a>
      </section>}
      {loading || loadingProjects ? <p role="status">Loading project records…</p> : projectId && project ? <>
        {area === 'projects' && <section className="card">
          <h2>Project details &amp; delivery configuration</h2><p>Approved changes are applied only after a second authorized reviewer confirms them.</p>
          <form onSubmit={saveProject}>
            <div className="form-grid">
              <label>Project name<input value={projectDraft.name} onChange={event => updateProject('name', event.target.value)} minLength={2} maxLength={140} required /></label>
              <label>Client<input value={projectDraft.client} onChange={event => updateProject('client', event.target.value)} maxLength={140} /></label>
              <label>Status<SmartSelect modelValue={projectDraft.status} ariaLabel="Project status" options={statuses} onChange={value => updateProject('status', String(value))} /></label>
              <label>Health<SmartSelect modelValue={projectDraft.health} ariaLabel="Project health" options={health} onChange={value => updateProject('health', String(value))} /></label>
            </div>
            <label>Description<textarea value={projectDraft.description} onChange={event => updateProject('description', event.target.value)} rows={3} maxLength={1500} /></label>
            <button type="submit" disabled={busy}>Submit edits for check</button>
          </form>
          <h2>Delivery tasks</h2>
          <div className="rows">{tasks.map(task => <div key={task.id} className="record">
            <div className="record-copy"><strong>{task.title}</strong><small>{task.dueDate ? 'Due ' + formatDate(task.dueDate) : 'No due date'}</small></div>
            <span className="pill">{task.status}</span>
            <button type="button" className="secondary" disabled={busy} onClick={() => proposeTask(task)}>
              {task.status === 'DONE' ? 'Reopen' : 'Mark done'} for check</button>
          </div>)}{tasks.length === 0 && <p>No approved tasks yet.</p>}</div>
        </section>}
        {area === 'raid' && <section className="card">
          <h2>RAID item detail &amp; resolution</h2><p>Update risk, issue or action records through an independent checker.</p>
          <div className="tabs">{tabs.map(tab => <button type="button" key={tab} className={raidTab === tab ? 'active' : undefined}
            aria-pressed={raidTab === tab} onClick={() => { setRaidTab(tab); setSelected(null); }}>
            {tab[0].toUpperCase() + tab.slice(1)} ({register[tab]?.length ?? 0})
          </button>)}</div>
          {visibleRecords.length > 0 ? <div className="rows">{visibleRecords.map(item => <div key={item.id} className="record">
            <div className="record-copy"><strong>{item.title}</strong><small>{item.severity || item.status || 'Recorded'} · {item.ownerName || 'No owner'}</small></div>
            <button type="button" className="secondary" onClick={() => selectItem(item)}>Review details</button>
          </div>)}</div> : <p>No approved records in this register.</p>}
          {selected && raidTab !== 'decisions' && <form className="raid-editor" onSubmit={saveRaid}>
            <h3>Edit {raidTab.slice(0, -1)} — {selected.title}</h3>
            <label>Title<input value={raidDraft.title} onChange={event => updateRaid('title', event.target.value)} minLength={2} required /></label>
            <div className="form-grid">
              <label>Status<SmartSelect modelValue={raidDraft.status} ariaLabel="RAID status" options={raidStatuses} onChange={value => updateRaid('status', String(value))} /></label>
              {(raidTab === 'risks' || raidTab === 'issues') && <label>Severity<SmartSelect modelValue={raidDraft.severity} ariaLabel="RAID severity" options={severities} onChange={value => updateRaid('severity', String(value))} /></label>}
            </div>
            <label>Owner<input value={raidDraft.ownerName} onChange={event => updateRaid('ownerName', event.target.value)} placeholder="Responsible person" /></label>
            {raidTab === 'risks' && <label>Mitigation<textarea value={raidDraft.mitigation} onChange={event => updateRaid('mitigation', event.target.value)} rows={3} /></label>}
            {raidTab === 'issues' && <label>Resolution<textarea value={raidDraft.resolution} onChange={event => updateRaid('resolution', event.target.value)} rows={3} /></label>}
            <button type="submit" disabled={busy}>Submit amendment for check</button>
          </form>}
        </section>}
        {area === 'timesheets' && <section className="card">
          <h2>Approved time entries</h2><p>Only independently approved hours contribute to the project effort log.</p>
          <div className="table-wrap"><table>
            <thead><tr>{['Date', 'Hours', 'Description', 'User'].map(col => <th key={col} scope="col">{col}</th>)}</tr></thead>
            <tbody>{entries.map(item => <tr key={item.id}><td>{formatDate(item.workDate)}</td><td>{Number(item.hours).toFixed(2)}</td>
              <td>{item.description || '—'}</td><td><span className="person"><span className="avatar">
                {item.userName?.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || 'TM'}
              </span>{item.userName || 'Team member'}</span></td></tr>)}
              {entries.length === 0 && <tr><td colSpan={4}>No approved entries.</td></tr>}</tbody>
          </table></div>
          <a className="link" href={link('/timesheets' + context)}>Log additional time</a>
        </section>}
        {area === 'reports' && <section className="card">
          <h2>Project executive detail</h2><p>Consolidated from approved project and task records.</p>
          {report && <div className="metric-grid">
            <article><small>Project health</small><strong>{report.health}</strong></article>
            <article><small>Delivery status</small><strong>{report.status}</strong></article>
            <article><small>Task completion</small><strong>{report.progressPercent}%</strong></article>
            <article><small>Overdue tasks</small><strong>{report.taskCounts.overdue}</strong></article>
          </div>}
          <h3>Overdue deliverables</h3>
          {report?.overdueTasks?.length ? <div className="rows">{report.overdueTasks.map(task => <div className="record" key={task.id}>
            <strong>{task.title}</strong><small>Due {formatDate(task.dueDate)}</small></div>)}</div> : <p>No overdue tasks.</p>}
          <a className="link" href={link('/reports')}>Approved executive publications</a>
        </section>}
      </> : !error && <section className="work-empty">
        <span className="record-icon material-symbols-outlined" aria-hidden="true">folder_open</span>
        <div><h2>No project available</h2><p>Open Projects to find an active project or follow a pending request.</p></div>
        <a className="pmo-control primary" href={link('/projects')}>View projects and requests</a>
      </section>}
      {project && <section className="card"><h2>Related workflows</h2><div className="links">
        <a href={link('/projects')}>Projects</a><a href={link('/raid' + context)}>RAID</a>
        <a href={link('/timesheets' + context)}>Timesheets</a><a href={link('/reports')}>Reports</a>
        <a href={link(approvalPath)}>View approvals</a>
      </div></section>}
    </main>
  );
}
