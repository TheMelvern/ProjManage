import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartDatePicker } from '../../../components/SmartDatePicker';
import { SmartSelect } from '../../../components/SmartSelect';
import './TimesheetWorkspace.css';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
interface Project { id: string; name: string }
interface Entry { id: string; workDate: string; description?: string; hours: number | string }
interface Props { requestedProject?: string; create?: boolean; link: (path: string) => string }

function localToday() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function localWorkDate(value: string | Date) {
  return typeof value === 'string' ? new Date(value.length === 10 ? value + 'T12:00:00' : value) : new Date(value);
}

function formatDate(value: string | Date) {
  return localWorkDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Operation failed');
}

export function TimesheetWorkspace({ requestedProject, create, link }: Props) {
  const today = localToday();
  const [workDate, setWorkDate] = useState(today);
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('8');
  const [description, setDescription] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(liveMode);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const submitting = useRef(false);
  const loading = projectsLoading || entriesLoading;
  const disabled = !liveMode || busy;
  const options = projects.map(project => ({ value: project.id, label: project.name }));
  const start = localWorkDate(today);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 + weekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const last = new Date(end);
  last.setDate(last.getDate() - 1);
  const weekly = entries.filter(entry => {
    const date = localWorkDate(entry.workDate);
    date.setHours(12, 0, 0, 0);
    return date >= start && date < end;
  });
  const weeklyHours = weekly.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    setProjectsLoading(true);
    setError('');
    void api.get<{ data: Project[] }>('/projects', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      setProjects(data.data);
      setProjectId(data.data.find(project => project.id === requestedProject)?.id ?? data.data[0]?.id ?? '');
    }).catch(failure => {
      if (!signal.aborted) setError(describe(failure));
    }).finally(() => {
      if (!signal.aborted) setProjectsLoading(false);
    });
    return () => controller.abort();
  }, [requestedProject]);

  useEffect(() => {
    setEntries([]);
    if (!projectId) {
      setEntriesLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setEntriesLoading(true);
    setError('');
    void api.get<{ data: Entry[] }>('/projects/' + encodeURIComponent(projectId) + '/timesheets', { signal }).then(({ data }) => {
      if (!signal.aborted) setEntries(data.data);
    }).catch(failure => {
      if (!signal.aborted) setError(describe(failure));
    }).finally(() => {
      if (!signal.aborted) setEntriesLoading(false);
    });
    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    if (create && projectId && projectId === requestedProject) setComposeOpen(true);
  }, [create, projectId, requestedProject]);

  function close() {
    if (!submitting.current) setComposeOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !liveMode || !projectId || !workDate) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post('/reviews/operations', {
        kind: 'TIMESHEET_CREATE', projectId,
        summary: 'Log ' + Number(hours) + ' hours for ' + workDate,
        values: { workDate: localWorkDate(workDate).toISOString(), hours: Number(hours), description: description.trim() },
      });
      setDescription('');
      setComposeOpen(false);
      setMessage('Timesheet submitted for independent approval.');
    } catch (failure) {
      setError(describe(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="timesheets operational-page">
      <header className="work-header operational-heading">
        <div><h1>Timesheets</h1><p>Log work against a project and track approved hours by week.</p></div>
        {projectId && <button type="button" className="pmo-control primary" onClick={() => setComposeOpen(true)}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>Log time
        </button>}
      </header>
      {!liveMode && <p className="notice" role="status">Sign in to a connected workspace to log time.</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice success" role="status">{message}</p>}
      {loading && <p role="status">Loading time entries{'\u2026'}</p>}
      {liveMode && !loading && !error && projects.length === 0 && <section className="work-empty">
        <span className="record-icon material-symbols-outlined" aria-hidden="true">schedule</span>
        <div><h2>No active project yet</h2><p>Once a project is approved, you can log time and see approved entries here.</p></div>
        <a className="pmo-control primary" href={link('/projects')}>View projects and requests</a>
      </section>}
      <PremiumComposeDialog open={composeOpen} title="New time entry" eyebrow="RESOURCE / TIMESHEETS"
        description="Choose a project, enter your hours, and send the entry for review." error={error} onClose={close}
        footer={<>
          <button type="button" className="pmo-control" disabled={busy} onClick={close}>Cancel</button>
          <button type="submit" form="time-entry-form" className="pmo-control primary" disabled={disabled || !projectId || !workDate}>
            {busy ? 'Submitting\u2026' : 'Submit for review'}
          </button>
        </>}>
        <form id="time-entry-form" className="entry-form" onSubmit={submit}>
          <div className="field full"><label htmlFor="timesheet-project">Project</label>
            <SmartSelect id="timesheet-project" modelValue={projectId} ariaLabel="Project" disabled={disabled}
              options={[{ value: '', label: 'Select project' }, ...options]} onChange={value => setProjectId(String(value))} />
          </div>
          <div className="field"><label htmlFor="timesheet-date">Work date</label>
            <SmartDatePicker id="timesheet-date" modelValue={workDate} ariaLabel="Work date" max={today} required disabled={disabled} onChange={setWorkDate} />
          </div>
          <div className="field"><label htmlFor="timesheet-hours">Hours worked</label>
            <input id="timesheet-hours" type="number" value={hours} onChange={event => setHours(event.target.value)}
              min="0.25" max="24" step="0.25" required disabled={disabled} />
          </div>
          <div className="field full"><label htmlFor="timesheet-description">Work completed</label>
            <textarea id="timesheet-description" value={description} onChange={event => setDescription(event.target.value)}
              rows={3} maxLength={1000} placeholder="Describe your work for the project" disabled={disabled} />
          </div>
        </form>
      </PremiumComposeDialog>
      {projects.length > 0 && <section className="work-panel" aria-labelledby="time-ledger">
        <header className="work-toolbar">
          <div><h2 id="time-ledger">Approved time</h2><p aria-live="polite">{formatDate(start)} {'\u2013'} {formatDate(last)} {'\u00b7'} {weeklyHours.toFixed(2)} hours</p></div>
          <div className="work-actions">
            <button type="button" className="pmo-control quiet" aria-label="Previous week" onClick={() => setWeekOffset(current => current - 1)}>{'\u2039'}</button>
            <button type="button" className="pmo-control quiet" onClick={() => setWeekOffset(0)}>This week</button>
            <button type="button" className="pmo-control quiet" aria-label="Next week" disabled={weekOffset >= 0} onClick={() => setWeekOffset(current => current + 1)}>{'\u203a'}</button>
          </div>
        </header>
        <div className="work-toolbar work-filters filter-toolbar">
          <label>Project <SmartSelect modelValue={projectId} ariaLabel="Timesheet project" options={options} onChange={value => setProjectId(String(value))} /></label>
          {projectId && <div className="work-actions">
            <a className="pmo-control quiet" href={link('/projects/' + encodeURIComponent(projectId) + '/workspace')}>Open project</a>
            <a className="pmo-control quiet" href={link('/timesheets/detail?projectId=' + encodeURIComponent(projectId))}>Full history</a>
          </div>}
        </div>
        {weekly.length > 0 ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Approved time entries this week">
          <table><thead><tr><th scope="col">Date</th><th scope="col">Work</th><th scope="col">Hours</th></tr></thead>
            <tbody>{weekly.map(entry => <tr key={entry.id}>
              <td>{formatDate(entry.workDate)}</td><td>{entry.description || 'No description'}</td><td className="hours">{Number(entry.hours).toFixed(2)}</td>
            </tr>)}</tbody>
          </table>
        </div> : !loading && !error && <p className="work-panel-empty">No approved time for this week. Entries appear after independent review.</p>}
      </section>}
    </main>
  );
}
