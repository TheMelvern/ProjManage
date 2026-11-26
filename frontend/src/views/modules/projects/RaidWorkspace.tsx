import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { FilterSummary } from '../../../components/FilterSummary';
import { SmartSelect } from '../../../components/SmartSelect';
import './RaidWorkspace.css';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const tabs = [
  { key: 'risks', label: 'Risks', operation: 'RISK' },
  { key: 'issues', label: 'Issues', operation: 'ISSUE' },
  { key: 'decisions', label: 'Decisions', operation: 'DECISION' },
  { key: 'actions', label: 'Actions', operation: 'ACTION' },
] as const;
type Tab = typeof tabs[number];
interface Project { id: string; name: string }
interface Entry { id: string; title: string; description?: string; status?: string; severity?: string; createdAt?: string; decidedAt?: string }
type Register = Record<Tab['key'], Entry[]>;
const emptyRegister: Register = { risks: [], issues: [], decisions: [], actions: [] };
const blankFilters = { search: '', status: '', severity: '' };
const statusOptions = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function display(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
}

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Operation failed');
}

export function RaidWorkspace({ requestedProject, link }: { requestedProject?: string; link: (path: string) => string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [register, setRegister] = useState(emptyRegister);
  const [filters, setFilters] = useState(blankFilters);
  const [tab, setTab] = useState<Tab>(tabs[0]);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [composeOpen, setComposeOpen] = useState(false);
  const [loading, setLoading] = useState(liveMode);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [revision, refresh] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const updating = useRef(false);
  const supportsSeverity = tab.key === 'risks' || tab.key === 'issues';
  const records = register[tab.key] ?? [];
  const singular = tab.key.slice(0, -1);
  const query = filters.search.trim().toLowerCase();
  const visible = records.filter(item =>
    (!filters.status || item.status === filters.status) &&
    (!filters.severity || item.severity === filters.severity) &&
    [item.title, item.description].some(value => (value || '').toLowerCase().includes(query)));
  const chips = [
    { key: 'search', label: 'Search', value: filters.search.trim() },
    { key: 'status', label: 'Status', value: display(filters.status) },
    { key: 'severity', label: 'Severity', value: display(filters.severity) },
  ].filter(item => item.value);

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    void api.get<{ data: Project[] }>('/projects', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      setProjects(data.data);
      setFilters(blankFilters);
      setProjectId(data.data.find(project => project.id === requestedProject)?.id ?? data.data[0]?.id ?? '');
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestedProject]);

  useEffect(() => {
    if (!projectId) {
      setRegister(emptyRegister);
      setRegisterLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setError('');
    setRegister(emptyRegister);
    setRegisterLoading(true);
    void api.get<{ data: Register }>('/projects/' + encodeURIComponent(projectId) + '/raid', { signal }).then(({ data }) => {
      if (!signal.aborted) setRegister({ ...emptyRegister, ...data.data });
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); })
      .finally(() => { if (!signal.aborted) setRegisterLoading(false); });
    return () => controller.abort();
  }, [projectId, revision]);

  function filter(key: keyof typeof blankFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  async function propose(kind: string, summary: string, values: object, targetId?: string) {
    if (!projectId || updating.current) return false;
    updating.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post('/reviews/operations', { kind, projectId, summary, values, ...(targetId ? { targetId } : {}) });
      return true;
    } catch (failure) {
      setError(describe(failure));
      return false;
    } finally {
      updating.current = false;
      setBusy(false);
    }
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (value.length < 2) return;
    if (await propose(tab.operation + '_CREATE', 'Create ' + singular + ' ' + value,
      { title: value, ...(supportsSeverity ? { severity } : {}) })) {
      setTitle('');
      setComposeOpen(false);
      setMessage('RAID item submitted for independent approval.');
    }
  }

  async function changeStatus(item: Entry, status: string) {
    if (tab.key === 'decisions') return;
    if (await propose(tab.operation + '_UPDATE', 'Change ' + tab.key + ' status for ' + item.title, { status }, item.id)) {
      setMessage('RAID status change submitted for independent approval.');
    }
  }

  return (
    <main className="raid-workspace operational-page">
      <header className="raid-header operational-heading">
        <div><h1>RAID Register</h1><p>Track risks, issues, decisions and action items across your project portfolio.</p></div>
        <div className="module-shortcuts">
          {projectId && <a className="pmo-control quiet" href={link('/projects/' + encodeURIComponent(projectId) + '/workspace')}>Open project</a>}
          <a className="pmo-control quiet" href={link('/raid/detail' + (projectId ? '?projectId=' + encodeURIComponent(projectId) : ''))}>Register history</a>
        </div>
      </header>
      {!liveMode && <p role="status" className="notice">This workspace requires local API mode. Set VITE_USE_LIVE_API=true and sign in.</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      {message && <p role="status" className="notice success">{message}</p>}
      {projects.length > 0 && <div className="selector filter-toolbar">
        <label htmlFor="raid-project">Project</label>
        <SmartSelect id="raid-project" modelValue={projectId} ariaLabel="Project" disabled={loading || busy}
          options={[{ value: '', label: 'Select a project' }, ...projects.map(project => ({ value: project.id, label: project.name }))]}
          onChange={value => { setFilters(blankFilters); setProjectId(String(value)); }} />
        <button type="button" disabled={!projectId || loading || registerLoading} onClick={() => refresh(current => current + 1)}>Refresh</button>
      </div>}
      {projectId ? <section className="register">
        <div className="tabs" role="group" aria-label="RAID category">
          {tabs.map(option => <button key={option.key} type="button" className={tab.key === option.key ? 'active' : undefined}
            aria-pressed={tab.key === option.key} onClick={() => { setTab(option); setFilters(blankFilters); }}>
            {option.label} <span>{register[option.key].length}</span></button>)}
        </div>
        <div className="premium-add-bar">
          <div><strong>{tab.label} register</strong><p>Capture a new entry for independent review.</p></div>
          <button type="button" className="premium-add-trigger" onClick={() => setComposeOpen(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span> Add {singular}
          </button>
        </div>
        <PremiumComposeDialog open={composeOpen} title={'New ' + singular} eyebrow="GOVERNANCE / NEW ENTRY"
          description="Document a clear description before routing this item for approval." error={error} onClose={() => { if (!busy) setComposeOpen(false); }}>
          <form className="add-form" onSubmit={addEntry}>
            <label htmlFor="raid-title">New {singular} title</label>
            <input id="raid-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} minLength={2}
              required disabled={busy} placeholder="Describe the item to track" />
            {supportsSeverity && <>
              <label htmlFor="raid-severity">Severity</label>
              <SmartSelect id="raid-severity" modelValue={severity} ariaLabel="Severity" disabled={busy} options={severityOptions} onChange={value => setSeverity(String(value))} />
            </>}
            <button type="submit" disabled={busy || title.trim().length < 2}>Submit item</button>
          </form>
        </PremiumComposeDialog>
        {records.length > 0 && <>
          <div className="filter-toolbar raid-filters" role="group" aria-label="RAID entry filters">
            <label>Search entries<input value={filters.search} onChange={event => filter('search', event.target.value)} type="search" placeholder="Title or description" /></label>
            {tab.key !== 'decisions' && <SmartSelect modelValue={filters.status} filterLabel="Status" ariaLabel="RAID status filter"
              options={[{ value: '', label: 'All statuses' }, ...statusOptions.map(value => ({ value, label: display(value) }))]}
              onChange={value => filter('status', String(value))} />}
            {supportsSeverity && <SmartSelect modelValue={filters.severity} filterLabel="Severity" ariaLabel="RAID severity filter"
              options={[{ value: '', label: 'All severities' }, ...severityOptions.map(value => ({ value, label: display(value) }))]}
              onChange={value => filter('severity', String(value))} />}
          </div>
          <FilterSummary chips={chips} count={visible.length} total={records.length} noun="entries"
            onRemove={key => filter(key as keyof typeof blankFilters, '')} onClear={() => setFilters(blankFilters)} />
        </>}
        {registerLoading ? <p role="status">Loading register…</p> : <div className="entries">
          {visible.map(item => {
            const stamp = item.createdAt || item.decidedAt;
            return <article key={item.id} className="entry operational-row">
              <div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}
                <small>{item.severity && <span className="record-state" data-state={item.severity}>{item.severity.toLowerCase()}</span>}
                  {' '}{stamp ? new Date(stamp).toLocaleDateString() : '—'}</small></div>
              {tab.key !== 'decisions' && <>
                <label htmlFor={'status-' + item.id}>Status</label>
                <SmartSelect id={'status-' + item.id} modelValue={item.status} ariaLabel="RAID item status"
                  disabled={busy} options={statusOptions} onChange={value => changeStatus(item, String(value))} />
              </>}
            </article>;
          })}
          {visible.length === 0 && <p className="empty">{records.length ? 'No entries match these filters.' : 'No ' + tab.key + ' recorded for this project.'}</p>}
        </div>}
      </section> : loading ? <p role="status">Loading projects…</p>
        : liveMode && !error && projects.length === 0 && <section className="workspace-start">
          <span className="record-icon material-symbols-outlined" aria-hidden="true">fact_check</span>
          <div><h2>No active projects yet</h2><p>Once a project is approved, you can track its risks, issues, decisions and actions here.</p></div>
          <a className="pmo-control" href={link('/projects')}>View projects and requests</a>
        </section>}
    </main>
  );
}
