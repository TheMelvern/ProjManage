import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartDatePicker } from '../../../components/SmartDatePicker';
import { SmartSelect } from '../../../components/SmartSelect';
import './ProjectHub.css';

const types = ['EPIC', 'STORY', 'TASK', 'BUG', 'MILESTONE'];
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const tabs = [
  ['info', 'Project info'], ['timesheets', 'Timesheets'], ['timeline', 'Timeline'],
  ['backlog', 'Backlog'], ['kanban', 'Kanban'], ['waterfall', 'Waterfall'],
] as const;
const empty = { itemType: 'STORY', priority: 'MEDIUM', title: '', description: '', phase: '', status: 'TODO',
  startDate: '', dueDate: '', parentId: '', dependsOnId: '' };
type Draft = typeof empty;
type Task = Pick<Draft, 'title' | 'status'> & Partial<Draft> & { id: string };
interface Project {
  id: string; name: string; status: string; health: string;
  description?: string; deliveryMethod?: string; client?: string; startDate?: string; targetEndDate?: string;
}
interface Entry { id: string; workDate: string; hours: number; userName?: string; description?: string }
interface Props {
  projectId: string;
  viewQuery?: string;
  onlyOverdue: boolean;
  create: boolean;
  link: (path: string) => string;
  patchQuery: (query: { view?: string; work?: string | undefined }) => void;
}
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const statusOptions = statuses.map(value => ({ value, label: pretty(value) }));
const date = (value?: string | number) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const stamp = (value?: string) => value ? new Date(value).getTime() : 0;
const dateKey = (value?: string) => value?.slice(0, 10) ?? '';
const day = 86400000;
const iso = (value: string) => new Date(value + 'T12:00:00').toISOString();

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Operation failed');
}

function taskDraft(task: Task): Draft {
  return {
    title: task.title, description: task.description || '', itemType: task.itemType || 'TASK',
    priority: task.priority || 'MEDIUM', phase: task.phase || '', status: task.status,
    startDate: dateKey(task.startDate), dueDate: dateKey(task.dueDate), parentId: task.parentId || '',
    dependsOnId: task.dependsOnId || '',
  };
}

function WorkFields({ draft, tasks, selected, update }: {
  draft: Draft; tasks: Task[]; selected?: string; update: (key: keyof Draft, value: string) => void;
}) {
  const choices = tasks.filter(task => task.id !== selected);
  const options = (items: Task[]) => items.map(item => ({ value: item.id, label: item.title }));
  return <div className="field-grid">
    <label>{selected ? 'Type' : 'Work type'}<SmartSelect modelValue={draft.itemType} ariaLabel={selected ? 'Detail work type' : 'Work item type'}
      options={types} onChange={value => update('itemType', String(value))} /></label>
    <label>Priority<SmartSelect modelValue={draft.priority} ariaLabel={selected ? 'Detail priority' : 'Work priority'}
      options={priorities} onChange={value => update('priority', String(value))} /></label>
    <label className="wide">Title<input value={draft.title} onChange={event => update('title', event.target.value)}
      required minLength={2} maxLength={200} placeholder={selected ? undefined : 'As a user, I want…'} /></label>
    <label className="wide">Description<textarea value={draft.description} onChange={event => update('description', event.target.value)}
      maxLength={1500} rows={selected ? 4 : 3} placeholder={selected ? undefined : 'Requirements, acceptance criteria, context'} /></label>
    <label>{selected ? 'Phase' : 'Phase / stage'}<input value={draft.phase} onChange={event => update('phase', event.target.value)}
      maxLength={100} placeholder={selected ? undefined : 'e.g. Design, Build, Test'} /></label>
    {selected && <label>Status<SmartSelect modelValue={draft.status} ariaLabel="Detail status" options={statusOptions}
      onChange={value => update('status', String(value))} /></label>}
    <label>{selected ? 'Start' : 'Start date'}<SmartDatePicker modelValue={draft.startDate} ariaLabel={selected ? 'Detail start date' : 'Work start date'}
      onChange={value => update('startDate', value)} /></label>
    <label>{selected ? 'Due' : 'Due date'}<SmartDatePicker modelValue={draft.dueDate} ariaLabel={selected ? 'Detail due date' : 'Work due date'}
      min={draft.startDate} onChange={value => update('dueDate', value)} /></label>
    <label>{selected ? 'Parent' : 'Parent story / epic'}<SmartSelect modelValue={draft.parentId}
      ariaLabel={selected ? 'Detail parent work item' : 'Parent work item'}
      options={[{ value: '', label: 'No parent' }, ...options(choices.filter(task => ['EPIC', 'STORY', 'TASK'].includes(task.itemType ?? '')))]}
      onChange={value => update('parentId', String(value))} /></label>
    <label>Depends on<SmartSelect modelValue={draft.dependsOnId} ariaLabel={selected ? 'Detail dependency' : 'Dependency work item'}
      options={[{ value: '', label: 'No dependency' }, ...options(choices)]} onChange={value => update('dependsOnId', String(value))} /></label>
  </div>;
}

export function ProjectHub({ projectId, viewQuery, onlyOverdue, create, link, patchQuery }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(create);
  const [draft, setDraft] = useState(empty);
  const [selected, setSelected] = useState<Task | null>(null);
  const [detail, setDetail] = useState(empty);
  const [scale, setScale] = useState('month');
  const dragging = useRef('');
  const submitting = useRef(false);
  const view = tabs.find(([key]) => key === viewQuery)?.[0] ?? (project?.deliveryMethod === 'WATERFALL' ? 'waterfall' : 'info');
  const hours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const progress = tasks.length ? Math.round(100 * tasks.filter(task => task.status === 'DONE').length / tasks.length) : 0;
  const phases = [...new Set(tasks.map(task => task.phase || 'Unassigned'))];
  const visible = onlyOverdue ? tasks.filter(task => task.dueDate && stamp(task.dueDate) < Date.now() && task.status !== 'DONE') : tasks;
  const dated: Task[] = [
    ...(project && (project.startDate || project.targetEndDate) ? [{
      id: 'project-charter', title: project.name + ' · Project plan', status: project.status, itemType: 'PROJECT',
      phase: 'Overall project', startDate: project.startDate, dueDate: project.targetEndDate,
    }] : []),
    ...tasks.filter(task => task.startDate || task.dueDate),
  ].sort((a, b) => stamp(a.startDate || a.dueDate) - stamp(b.startDate || b.dueDate));
  const first = new Date(Math.min(...dated.map(task => stamp(task.startDate || task.dueDate))));
  const scaleMonth = (month: number) => scale === 'year' ? 0 : scale === 'quarter' ? Math.floor(month / 3) * 3 : month;
  const timelineMin = new Date(first.getFullYear(), scaleMonth(first.getMonth()), 1).getTime();
  const last = new Date(Math.max(...dated.map(task => stamp(task.dueDate || task.startDate)), timelineMin + day));
  const timelineMax = new Date(last.getFullYear(), scaleMonth(last.getMonth()) + (scale === 'year' ? 12 : scale === 'quarter' ? 3 : 1), 1).getTime();
  const timelineSpan = Math.max(day, timelineMax - timelineMin);
  const context = '?projectId=' + encodeURIComponent(projectId);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const path = '/projects/' + encodeURIComponent(projectId);
    setProject(null);
    setTasks([]);
    setEntries([]);
    setSelected(null);
    setLoading(true);
    setError('');
    void Promise.all([
      api.get<{ data: Project }>(path, { signal }),
      api.get<{ data: Task[] }>(path + '/tasks', { signal }),
      api.get<{ data: Entry[] }>(path + '/timesheets', { signal }),
    ]).then(([record, work, time]) => {
      if (signal.aborted) return;
      setProject(record.data.data);
      setTasks(work.data.data);
      setEntries(time.data.data);
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId]);

  useEffect(() => { if (create) setShowCreate(true); }, [create, projectId]);

  function openDetails(task: Task) {
    if (task.id === 'project-charter') return;
    setSelected(task);
    setDetail(taskDraft(task));
    setError('');
    setNotice('');
  }

  async function propose(kind: string, summary: string, values: object, message: string, targetId?: string) {
    if (submitting.current) return false;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/reviews/operations', { kind, projectId, summary, values, ...(targetId ? { targetId } : {}) });
      setNotice(message);
      return true;
    } catch (failure) {
      setError(describe(failure));
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { title, description, itemType, priority, phase, parentId, dependsOnId, startDate, dueDate } = draft;
    if (title.trim().length < 2) return;
    if (startDate && dueDate && dueDate < startDate) {
      setError('End date must follow start date.');
      return;
    }
    if (await propose('TASK_CREATE', 'Create ' + itemType.toLowerCase() + ' ' + title.trim(), {
      title: title.trim(), description: description.trim(), itemType, priority, ...(phase.trim() ? { phase: phase.trim() } : {}),
      ...(parentId ? { parentId } : {}), ...(dependsOnId ? { dependsOnId } : {}),
      ...(startDate ? { startDate: iso(startDate) } : {}), ...(dueDate ? { dueDate: iso(dueDate) } : {}),
    }, 'Work item submitted for independent approval.')) {
      setDraft({ ...empty, itemType, priority });
      setShowCreate(false);
    }
  }

  function updateStatus(task: Task, status: string) {
    if (status !== task.status) void propose('TASK_UPDATE', 'Update work item ' + task.title, { status },
      'Status update submitted for independent approval.', task.id);
  }

  function saveDetails() {
    if (!selected || detail.title.trim().length < 2) return;
    if (detail.startDate && detail.dueDate && detail.dueDate < detail.startDate) {
      setError('Due date must not precede the start date.');
      return;
    }
    const changes: Partial<Record<keyof Draft, string | null>> = {};
    for (const key of Object.keys(detail) as (keyof Draft)[]) {
      const value = detail[key].trim();
      const isDate = key === 'startDate' || key === 'dueDate';
      const initial = isDate ? dateKey(selected[key]) : selected[key] || '';
      if (initial === value) continue;
      changes[key] = isDate ? (value ? iso(value) : null) :
        ['parentId', 'dependsOnId', 'phase', 'description'].includes(key) ? value || null : value;
    }
    if (!Object.keys(changes).length) {
      setError('');
      setNotice('No changes to submit.');
      return;
    }
    void propose('TASK_UPDATE', 'Edit work item ' + selected.title, changes, 'Changes submitted for independent approval.', selected.id);
  }

  function statusSelect(task: Task, prefix: string) {
    return <SmartSelect modelValue={task.status} ariaLabel={prefix + task.title} options={statusOptions}
      disabled={busy} onChange={value => updateStatus(task, String(value))} />;
  }
  function workRow(task: Task, subtitle: string) {
    return <article className="work-row" key={task.id}>
      <span className="type">{task.itemType || 'TASK'}</span><div>
        <button className="task-title" type="button" onClick={() => openDetails(task)}>{task.title}</button><small>{subtitle}</small>
      </div>{statusSelect(task, 'Status for ')}
    </article>;
  }

  return <main className="hub operational-page">
    <header className="hub-header operational-heading">
      <div><a href={link('/projects')} className="back">← Projects &amp; Tasks</a>
        <h1>{project?.name || 'Project workspace'}</h1><p>{project?.description || 'Plan work, delivery and effort in one place.'}</p>
      </div>
      {project && <>
        <a className="pmo-control quiet" href={link('/raid' + context)}>Project RAID</a>
        <span className="project-pill">{pretty(project.status)} · {({ GREEN: 'On track', AMBER: 'At risk', RED: 'Critical' } as Record<string, string>)[project.health] || pretty(project.health)}</span>
      </>}
    </header>
    {error && <p className="alert error" role="alert">{error}</p>}
    {notice && <><p className="alert" role="status">{notice}</p>
      <div className="work-actions"><a className="pmo-control quiet" href={link('/projects/approvals?scope=MINE')}>Track submitted changes</a></div></>}
    {loading ? <p role="status">Loading project workspace…</p> : project && <>
      <section className="insights">
        <article><small>Delivery method</small><strong>{project.deliveryMethod === 'WATERFALL' ? 'Waterfall' : 'Kanban / Agile'}</strong></article>
        <article><small>Work items</small><strong>{tasks.length}</strong></article>
        <article><small>Completed</small><strong>{progress}%</strong></article>
        <article><small>Approved time</small><strong>{hours.toFixed(1)} h</strong></article>
      </section>
      <nav className="hub-tabs" aria-label="Project workspace views">{tabs.map(([key, label]) => <button key={key} type="button"
        className={view === key ? 'active' : undefined} aria-pressed={view === key} onClick={() => patchQuery({ view: key })}>{label}</button>)}</nav>
      {view === 'info' && <section className="panel">
        <div className="section-title"><h2>Project information</h2><span>Approved project charter</span></div>
        <div className="information">{[
          ['Project name', project.name], ['Client / business unit', project.client || 'Not specified'],
          ['Status', project.status], ['Health', project.health], ['Planned start', date(project.startDate)],
          ['Target completion', date(project.targetEndDate)], ['Delivery approach', project.deliveryMethod || 'KANBAN'],
        ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <div className="overview"><h3>Overview</h3><p>{project.description || 'No project overview has been provided.'}</p></div>
        <a href={link('/projects/detail' + context)} className="secondary-link">Submit project amendments for approval</a>
      </section>}
      {view === 'timesheets' && <section className="panel">
        <div className="section-title"><h2>Project timesheet</h2><a href={link('/timesheets' + context)} className="secondary-link">Submit time entry</a></div>
        <p className="hint">These entries show approved effort only. Team access follows the project's existing timesheet permissions.</p>
        <div className="scroll-table" tabIndex={0} role="region" aria-label="Project timesheet table"><table>
          <thead><tr>{['Date', 'Team member', 'Hours', 'Work description'].map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
          <tbody>{entries.map(row => <tr key={row.id}><td>{date(row.workDate)}</td><td>{row.userName || 'Team member'}</td>
            <td>{Number(row.hours).toFixed(2)}</td><td>{row.description || '—'}</td></tr>)}
            {entries.length === 0 && <tr><td colSpan={4}>No approved time entries yet.</td></tr>}</tbody>
        </table></div>
      </section>}
      {view === 'timeline' && <section className="panel">
        <div className="section-title"><h2>Project timeline</h2><div className="timeline-controls">
          <label htmlFor="timeline-scale">Scale</label><SmartSelect id="timeline-scale" modelValue={scale} ariaLabel="Timeline scale"
            options={['month', 'quarter', 'year'].map(value => ({ value, label: pretty(value) }))} onChange={value => setScale(String(value))} />
          <span>{tasks.length} work items</span></div></div>
        <p className="hint">Milestones, project dates and task dependencies share one schedule. Select a bar to inspect a work item.</p>
        {dated.length === 0 ? <div className="empty">No scheduled work yet. Add project dates or plan work-item dates to see the timeline.</div>
          : <div className="timeline-scroll" tabIndex={0} role="region" aria-label="Project delivery timeline">
            <div className="timeline-head"><span>Work item</span><span>{date(timelineMin)}</span><span>{date(timelineMax)}</span></div>
            {dated.map(task => {
              const start = stamp(task.startDate || task.dueDate);
              const end = stamp(task.dueDate || task.startDate);
              return <div className="timeline-row" key={task.id}><strong>{task.title}</strong>
                <div className="timeline-track"><button type="button" className={'timeline-bar ' + task.status.toLowerCase() + (task.itemType === 'MILESTONE' ? ' milestone' : '')}
                  style={{ left: Math.max(0, (start - timelineMin) / timelineSpan * 100) + '%',
                    width: Math.max(2, Math.min(100, (Math.max(end, start) - start + day) / timelineSpan * 100)) + '%' }}
                  title={task.title + ' · ' + date(task.startDate || task.dueDate) + ' → ' + date(task.dueDate || task.startDate)}
                  disabled={task.id === 'project-charter'} onClick={() => openDetails(task)}><span className="sr-only">Inspect {task.title}</span></button>
                </div><small>{task.phase || task.itemType}</small></div>;
            })}
          </div>}
      </section>}
      {(view === 'backlog' || view === 'kanban' || view === 'waterfall') && <section className="panel">
        <div className="section-title"><div>
          <h2>{view === 'backlog' ? 'Work item backlog' : view === 'kanban' ? 'Kanban board' : 'Waterfall delivery phases'}</h2>
          <p className="hint">Epics, stories, tasks, bugs and milestones use one approved work-item register.</p>
        </div><button type="button" className="primary" onClick={() => setShowCreate(current => !current)}>{showCreate ? 'Close creation' : '+ New work item'}</button></div>
        <PremiumComposeDialog open={showCreate} title="Create a work item" eyebrow="PROJECTS / NEW WORK"
          description="Describe the outcome, set delivery details, and submit it for independent approval." error={error}
          onClose={() => { if (!busy) setShowCreate(false); }}>
          <form className="item-form" onSubmit={createItem}>
            <WorkFields draft={draft} tasks={tasks} update={(key, value) => setDraft(current => ({ ...current, [key]: value }))} />
            <button className="primary" disabled={busy || draft.title.trim().length < 2} type="submit">{busy ? 'Submitting…' : 'Submit work item for approval'}</button>
          </form>
        </PremiumComposeDialog>
        {view === 'backlog' ? <div className="backlog">
          <div className="work-actions"><button type="button" className="pmo-control quiet" aria-pressed={onlyOverdue}
            onClick={() => patchQuery({ work: onlyOverdue ? undefined : 'overdue' })}>Overdue only</button></div>
          {visible.map(task => workRow(task, (task.phase || 'Unassigned phase') + ' · ' + (task.priority || 'MEDIUM') + ' priority · ' + date(task.dueDate)))}
          {visible.length === 0 && <div className="empty">{onlyOverdue ? 'No overdue work items.' : 'No approved work items yet. Create an epic, story or task to start the backlog.'}</div>}
        </div> : view === 'kanban' ? <div className="board" tabIndex={0} role="region" aria-label="Kanban board">
          {statuses.map(status => {
            const column = tasks.filter(task => task.status === status);
            return <div className="board-column" key={status} onDragOver={event => event.preventDefault()} onDrop={event => {
              event.preventDefault();
              const task = tasks.find(item => item.id === dragging.current);
              dragging.current = '';
              if (task && !busy) updateStatus(task, status);
            }}>
              <div className="column-head"><strong>{pretty(status)}</strong><span>{column.length}</span></div>
              {column.map(task => <article className="board-card" key={task.id} draggable={!busy}
                onDragStart={event => { dragging.current = task.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); }}
                onDragEnd={() => { dragging.current = ''; }}>
                <small>{task.itemType || 'TASK'} · {task.priority || 'MEDIUM'}</small>
                <button className="task-title" type="button" onClick={() => openDetails(task)}>{task.title}</button>
                <p>{task.description || 'No details yet'}</p>
                {task.parentId && <small>Subtask · {tasks.find(item => item.id === task.parentId)?.title || 'Unknown task'}</small>}
                {task.dependsOnId && <small>Depends on · {tasks.find(item => item.id === task.dependsOnId)?.title || 'Unknown task'}</small>}
                {statusSelect(task, 'Move ')}
              </article>)}
            </div>;
          })}
        </div> : <div className="phases">
          {phases.map(phase => {
            const items = tasks.filter(task => (task.phase || 'Unassigned') === phase);
            return <div className="phase" key={phase}><h3>{phase} <span>{items.length} items</span></h3>
              {items.map(task => workRow(task, date(task.startDate) + ' → ' + date(task.dueDate)))}</div>;
          })}
          {phases.length === 0 && <div className="empty">No phases yet. Add work items with a phase name.</div>}
        </div>}
      </section>}
      {selected && <PremiumComposeDialog open title={selected.title}
        eyebrow={pretty(selected.itemType || 'TASK') + ' · ' + pretty(selected.priority || 'MEDIUM')}
        error={error} onClose={() => { if (!busy) setSelected(null); }} footer={<>
          <button type="button" className="pmo-control" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
          <button type="button" className="pmo-control primary" disabled={busy || detail.title.trim().length < 2} onClick={saveDetails}>{busy ? 'Submitting…' : 'Submit changes for approval'}</button>
        </>}>
        {notice && <p role="status" className="alert">{notice}</p>}
        <div className="work-item-fields">
          <WorkFields draft={detail} tasks={tasks} selected={selected.id} update={(key, value) => setDetail(current => ({ ...current, [key]: value }))} />
          {tasks.some(task => task.parentId === selected.id) && <div className="related-items"><strong>Subtasks</strong>
            {tasks.filter(task => task.parentId === selected.id).map(task => <button key={task.id} type="button" onClick={() => openDetails(task)}>
              {task.title} · {pretty(task.status)}</button>)}
          </div>}
          <p className="hint">Edits, dependency changes and status moves require independent approval before appearing on the board.</p>
        </div>
      </PremiumComposeDialog>}
    </>}
  </main>;
}
