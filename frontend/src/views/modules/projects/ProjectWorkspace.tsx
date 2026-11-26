import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { FilterSummary } from '../../../components/FilterSummary';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartDatePicker } from '../../../components/SmartDatePicker';
import { SmartSelect } from '../../../components/SmartSelect';
import './ProjectWorkspace.css';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const selectionKey = 'pmo-selected-project';
const healthOptions = [
  { value: '', label: 'All health statuses' }, { value: 'GREEN', label: 'On track' },
  { value: 'AMBER', label: 'At risk' }, { value: 'RED', label: 'Critical' },
];
interface Project { id: string; name: string; client?: string; description?: string; health: string; status: string; targetEndDate?: string; _count?: { tasks?: number } }
interface Task { id: string; title: string; status: string; dueDate?: string }
interface ProjectRequest {
  id: string; kind: string; makerId: string; status: string; summary: string; updatedAt?: string; createdAt?: string;
  proposed?: { values?: { name?: string } };
}
const projectStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const projectHealthOptions = ['UNKNOWN', 'GREEN', 'AMBER', 'RED'];
const taskStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const requestDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function formatLabel(value: string) {
  return String(value).toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
const displayOptions = (values: string[]) => values.map(value => ({ value, label: formatLabel(value) }));
const projectPath = (id: string) => '/projects/' + encodeURIComponent(id) + '/workspace';

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'The operation failed.');
}

export function ProjectWorkspace({ link }: { link: (path: string) => string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(selectionKey) || '');
  const [status, setStatus] = useState('PLANNING');
  const [health, setHealth] = useState('UNKNOWN');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [loading, setLoading] = useState(liveMode);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(liveMode);
  const [requestsError, setRequestsError] = useState(false);
  const [requestRevision, refreshRequests] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const updating = useRef(false);
  const selected = projects.find(project => project.id === selectedId);
  const disabled = !liveMode || busy;
  const term = query.trim();
  const filterLabel = healthOptions.find(option => option.value === healthFilter)?.label;
  const visible = projects.filter(project => (!healthFilter || project.health === healthFilter) &&
    [project.name, project.client].some(value => (value || '').toLowerCase().includes(term.toLowerCase())));
  const chips = [
    ...(term ? [{ key: 'name', label: 'Search', value: term }] : []),
    ...(healthFilter && filterLabel ? [{ key: 'health', label: 'Health', value: filterLabel }] : []),
  ];
  const progress = tasks.length ? Math.round(tasks.filter(task => task.status === 'DONE').length / tasks.length * 100) : 0;

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    void api.get<{ data: Project[] }>('/projects', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      setProjects(data.data);
      setSelectedId(current => data.data.some(item => item.id === current) ? current : data.data[0]?.id ?? '');
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    setRequestsLoading(true);
    setRequestsError(false);
    void api.get<{ data: ProjectRequest[] }>('/reviews', { params: { module: 'projects' }, signal }).then(({ data }) => {
      if (signal.aborted) return;
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
      setRequests(data.data.filter(request => request.kind === 'PROJECT_CREATE' && request.makerId === userId));
    }).catch(() => { if (!signal.aborted) setRequestsError(true); })
      .finally(() => { if (!signal.aborted) setRequestsLoading(false); });
    return () => controller.abort();
  }, [requestRevision]);

  useEffect(() => {
    if (loading) return;
    if (selectedId) sessionStorage.setItem(selectionKey, selectedId);
    else sessionStorage.removeItem(selectionKey);
  }, [loading, selectedId]);

  useEffect(() => {
    setStatus(selected?.status || 'PLANNING');
    setHealth(selected?.health || 'UNKNOWN');
    setTasks([]);
    if (!selected) {
      setTasksLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setTasksLoading(true);
    void api.get<{ data: Task[] }>('/projects/' + encodeURIComponent(selected.id) + '/tasks', { signal }).then(({ data }) => {
      if (!signal.aborted) setTasks(data.data);
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setTasksLoading(false); });
    return () => controller.abort();
  }, [selected]);

  async function propose(endpoint: string, data: object, message: string) {
    if (!liveMode || !selectedId || updating.current) return false;
    updating.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.post(endpoint, { projectId: selectedId, ...data });
      setSuccess(message);
      return true;
    } catch (failure) {
      setError(describe(failure));
      return false;
    } finally {
      updating.current = false;
      setBusy(false);
    }
  }

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) void propose('/reviews/projects', { status, health, summary: 'Review delivery status for ' + selected.name },
      'Project change submitted for independent approval. It will not affect reports until approved.');
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (title.length < 2) return;
    if (await propose('/reviews/operations', {
      kind: 'TASK_CREATE', summary: 'Create task ' + title,
      values: { title, ...(taskDue ? { dueDate: new Date(taskDue + 'T12:00:00').toISOString() } : {}) },
    }, 'Task proposal submitted for independent approval.')) {
      setTaskTitle('');
      setTaskDue('');
      setComposeOpen(false);
    }
  }

  return (
    <main className="workspace operational-page">
      <header className="workspace-header operational-heading">
        <div><h1>Projects &amp; tasks</h1><p>Plan delivery and track project requests across your workspace.</p></div>
        <a href={link('/projects/new')} className="create-project-action"><span className="material-symbols-outlined" aria-hidden="true">add</span>Create project</a>
      </header>
      {!liveMode && <p className="notice" role="status">Connect your local API and set VITE_USE_LIVE_API=true to use the persistent workspace.</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {success && <p className="notice success" role="status">{success}</p>}
      {liveMode && <section className="workspace-card requests" aria-labelledby="my-project-requests">
        <h2 id="my-project-requests">My project requests</h2>
        {requestsLoading ? <p role="status">Loading your requests…</p>
          : requestsError ? <p role="alert">Could not load requests. <button type="button" onClick={() => refreshRequests(value => value + 1)}>Retry</button></p>
          : requests.length === 0 ? <p>You have no project creation requests.</p>
          : <ul>{requests.map(item => {
            const updated = item.updatedAt || item.createdAt;
            return <li key={item.id}><a className="request-row" href={link('/projects/approvals/' + encodeURIComponent(item.id))}>
              <span className="record-icon material-symbols-outlined" aria-hidden="true">description</span>
              <strong>{item.proposed?.values?.name || item.summary}</strong>
              <span className="record-state" data-state={item.status}>{item.status === 'PENDING' ? 'Pending review' : formatLabel(item.status)}</span>
              {updated && <time dateTime={updated}>Updated {requestDate.format(new Date(updated))}</time>}
              <span className="material-symbols-outlined row-arrow" aria-hidden="true">chevron_right</span>
            </a></li>;
          })}</ul>}
      </section>}
      <div className="project-overview"><section className="workspace-card project-list">
        <div className="section-heading"><h2>Active projects</h2></div>
        {loading ? <div className="loading" role="status">Loading projects…</div>
          : projects.length === 0 ? !error && <div className="empty-project-landing">
            <span className="record-icon material-symbols-outlined" aria-hidden="true">folder_open</span>
            <div><h3>No active projects yet</h3><p>Approved projects will appear here and become available for delivery, RAID and timesheets.</p></div>
          </div> : <>
            <div className="filter-toolbar" role="group" aria-label="Project filters">
              <label>Search projects<input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Project or client" /></label>
              <SmartSelect modelValue={healthFilter} filterLabel="Health" ariaLabel="Project health filter" options={healthOptions} onChange={value => setHealthFilter(String(value))} />
            </div>
            <FilterSummary chips={chips} count={visible.length} total={projects.length} noun="projects"
              onRemove={key => key === 'name' ? setQuery('') : setHealthFilter('')}
              onClear={() => { setQuery(''); setHealthFilter(''); }} />
            {visible.length === 0 ? <p>No projects match these filters.</p> : <ul className="project-records record-list">
              {visible.map(item => <li key={item.id}>
                <a className="project-record-link record-row" href={link(projectPath(item.id))}>
                  <span className="record-icon material-symbols-outlined" aria-hidden="true">folder_open</span>
                  <span className="project-identity"><strong>{item.name}</strong>{item.client && <small>{item.client}</small>}</span>
                  <span className="record-state" data-state={item.health}>{healthOptions.find(option => option.value === item.health && item.health)?.label ?? formatLabel(item.status)}</span>
                  <span className="project-target">{item.targetEndDate && <span>Target {requestDate.format(new Date(item.targetEndDate))}</span>}
                    <span>{item._count?.tasks ?? 0} work items</span></span>
                  <span className="material-symbols-outlined project-arrow" aria-hidden="true">chevron_right</span>
                </a>
                <button type="button" className="project-quick-view" aria-expanded={item.id === selectedId}
                  aria-controls="project-quick-details" disabled={busy} onClick={() => setSelectedId(item.id)}>Quick view</button>
              </li>)}
            </ul>}
          </>}
      </section></div>
      {selected && <div id="project-quick-details" className="workspace-layout"><section className="workspace-card project-detail">
        <a className="project-workspace-link" href={link(projectPath(selected.id))}>Open project workspace →</a>
        <div className="section-heading"><h2>{selected.name}</h2><span>{tasks.length} tasks</span></div>
        <p className="detail-desc">{selected.description || 'Project delivery and milestone tracking.'}</p>
        <form className="detail-settings" onSubmit={saveProject}>
          <div><label htmlFor="project-status">Status</label><SmartSelect id="project-status" modelValue={status} ariaLabel="Status"
            disabled={disabled} options={displayOptions(projectStatuses)} onChange={value => setStatus(String(value))} /></div>
          <div><label htmlFor="project-health">Health</label><SmartSelect id="project-health" modelValue={health} ariaLabel="Health"
            disabled={disabled} options={displayOptions(projectHealthOptions)} onChange={value => setHealth(String(value))} /></div>
          <button type="submit" disabled={disabled}>Submit for check</button>
        </form>
        <div className="task-header"><h3>Delivery tasks</h3><span>{progress}% complete</span></div>
        <div className="progress-track" aria-label={progress + '% of tasks completed'} role="progressbar"
          aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: progress + '%' }} />
        </div>
        <button type="button" className="premium-add-trigger" onClick={() => setComposeOpen(true)}>
          <span className="material-symbols-outlined" aria-hidden="true">add_circle</span> Add delivery task
        </button>
        <PremiumComposeDialog open={composeOpen} title="New delivery task" eyebrow="PROJECTS / TASKS"
          description="Create a deliverable for independent approval. Use the project workspace for stories, priorities and dependencies."
          error={error} onClose={() => { if (!busy) setComposeOpen(false); }}>
          <form className="task-create" onSubmit={createTask}>
            <label htmlFor="task-title">New task</label><input id="task-title" value={taskTitle} onChange={event => setTaskTitle(event.target.value)}
              placeholder="Task or deliverable name" minLength={2} maxLength={200} required disabled={disabled} />
            <label htmlFor="task-due">Due date (optional)</label>
            <SmartDatePicker id="task-due" modelValue={taskDue} ariaLabel="Due date (optional)" disabled={disabled} onChange={setTaskDue} />
            <button type="submit" disabled={disabled || taskTitle.trim().length < 2}>Submit task</button>
          </form>
        </PremiumComposeDialog>
        {tasksLoading ? <p role="status">Loading delivery tasks…</p> : <ul className="tasks">
          {tasks.map(task => <li key={task.id}>
            <div className="task-details"><strong>{task.title}</strong>
              <small>{task.dueDate ? 'Due ' + new Date(task.dueDate).toLocaleDateString() : 'No due date'}</small></div>
            <label htmlFor={'task-status-' + task.id}>Status</label>
            <SmartSelect id={'task-status-' + task.id} modelValue={task.status} ariaLabel="Status" disabled={disabled}
              options={displayOptions(taskStatuses)} onChange={value => propose('/reviews/operations', {
                kind: 'TASK_UPDATE', targetId: task.id, summary: 'Update task status for ' + task.title, values: { status: value },
              }, 'Task change submitted for independent approval.')} />
          </li>)}
          {tasks.length === 0 && <li className="task-empty">No tasks logged yet. Add a delivery task to measure progress.</li>}
        </ul>}
      </section></div>}
    </main>
  );
}
