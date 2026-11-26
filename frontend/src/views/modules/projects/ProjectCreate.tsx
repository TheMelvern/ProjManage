import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { SmartDatePicker } from '../../../components/SmartDatePicker';
import './ProjectCreate.css';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
const blank = { name: '', client: '', reference: '', description: '', method: 'KANBAN', startDate: '', endDate: '' };
interface Revision {
  id: string;
  kind: string;
  status: string;
  makerId: string;
  comment?: string;
  proposed?: { values?: { name?: string; client?: string; description?: string; deliveryMethod?: string; startDate?: string; targetEndDate?: string } };
}
interface Props {
  revise?: string;
  link: (path: string) => string;
  setLeaveGuard: (guard: (() => boolean) | undefined) => void;
}
const deliveryOptions = [
  { value: 'KANBAN', label: 'Agile \u00b7 Kanban', description: 'Manage work across status columns.' },
  { value: 'WATERFALL', label: 'Waterfall \u00b7 Phases', description: 'Organize deliverables into phases and milestones.' },
];

export function ProjectCreate({ revise, link, setLeaveGuard }: Props) {
  const [draft, setDraft] = useState(blank);
  const { name, client, reference, description, method, startDate, endDate } = draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [original, setOriginal] = useState<Revision | null>(null);
  const [revisionLoading, setRevisionLoading] = useState(Boolean(revise));
  const submitting = useRef(false);

  useEffect(() => {
    if (!revise) return;
    const controller = new AbortController();
    const { signal } = controller;
    setRevisionLoading(true);
    setOriginal(null);
    setError('');
    async function loadRevision() {
      try {
        const { data } = await api.get<{ data: Revision[] }>('/reviews', { params: { module: 'projects', id: revise }, signal });
        if (signal.aborted) return;
        const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
        const request = data.data.find(item => item.kind === 'PROJECT_CREATE' && item.status === 'RETURNED' && item.makerId === userId);
        const values = request?.proposed?.values;
        if (!request || !values) throw new Error('The returned charter could not be loaded.');
        const description = values.description || '';
        const match = description.match(/^Reference: ([^\n]+)(?:\n|$)/);
        setOriginal(request);
        setDraft({
          name: values.name || '', client: values.client || '', reference: match?.[1] || '',
          description: description.slice(match?.[0].length ?? 0), method: values.deliveryMethod || 'KANBAN',
          startDate: values.startDate?.slice(0, 10) || '', endDate: values.targetEndDate?.slice(0, 10) || '',
        });
      } catch (failure) {
        if (!signal.aborted) setError(failure instanceof Error ? failure.message : 'The returned charter could not be loaded.');
      } finally {
        if (!signal.aborted) setRevisionLoading(false);
      }
    }
    void loadRevision();
    return () => controller.abort();
  }, [revise]);

  useEffect(() => {
    const dirty = [name, client, reference, description].some(value => value.trim()) || startDate || endDate || method !== 'KANBAN';
    setLeaveGuard(() => !submitting.current && (success || !dirty || window.confirm('Discard your unsaved project draft?')));
    return () => setLeaveGuard(undefined);
  }, [name, client, reference, description, startDate, endDate, method, success, setLeaveGuard]);

  function update(field: keyof typeof blank, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !liveMode || name.trim().length < 2 || revisionLoading || (revise && !original)) return;
    setError('');
    if (endDate && startDate && endDate < startDate) {
      setError('Target completion must be after the start date.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await api.post<{ data?: { id: string } }>('/reviews/operations', {
        kind: 'PROJECT_CREATE',
        ...(original ? { revisesRequestId: original.id } : {}),
        summary: 'Create project ' + name.trim(),
        values: {
          name: name.trim(), client: client.trim(),
          description: [reference.trim() && 'Reference: ' + reference.trim(), description.trim()].filter(Boolean).join('\n'),
          deliveryMethod: method,
          ...(startDate ? { startDate: new Date(startDate + 'T12:00:00').toISOString() } : {}),
          ...(endDate ? { targetEndDate: new Date(endDate + 'T12:00:00').toISOString() } : {}),
        },
      });
      setSubmittedId(result.data.data?.id || '');
      setSuccess(true);
    } catch (failure) {
      const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
      setError((Array.isArray(message) ? message.join(', ') : message) ||
        (failure instanceof Error ? failure.message : 'Could not submit the project charter.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
  <main className="create-page operational-page">
    <header className="page-top operational-heading"><div><h1>Create a project</h1><p>Set up the project charter, delivery approach, and initial schedule. An independent checker approves the project before it becomes active.</p></div><a className="pmo-control quiet" href={link("/projects")}>Back to projects</a></header>
    {revisionLoading && <p role="status">Loading the returned charter…</p>}
    {original && <p className="notice">Revising a returned request. {original.comment && <strong>Checker: {original.comment}</strong>}</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
    {success ? <section className="success-card" role="status"><span className="material-symbols-outlined">task_alt</span><h2>Project submitted for approval</h2><p>Your project charter is pending independent review. Once approved, its Project Workspace will appear among the project cards.</p><div className="actions"><a href={link(submittedId ? "/projects/approvals/" + encodeURIComponent(submittedId) : "/projects/approvals")}>Track approval</a><a href={link("/projects")}>Back to projects</a></div></section>
    : <form id="project-charter-form" onSubmit={create} className="create-grid">
      <div className="main-fields">
        <section className="panel"><div className="section-heading"><div><h2>Project information</h2><p>Define what success looks like and who the project serves.</p></div></div>
          <div className="field-grid"><label className="wide">Project name (required) <input value={name} onChange={event => update("name", event.target.value)} required minLength={2} maxLength={140} placeholder="e.g. Customer self-service portal" /></label><label>Client / business unit (optional) <input value={client} onChange={event => update("client", event.target.value)} maxLength={140} placeholder="Internal or external customer" /></label><label>Project reference (optional) <input value={reference} onChange={event => update("reference", event.target.value)} maxLength={40} placeholder="Optional internal reference" /></label></div>
          <label className="stacked">Overview and outcome <textarea value={description} onChange={event => update("description", event.target.value)} rows={5} maxLength={1500} placeholder="Business objective, scope, key deliverables and success criteria" /></label>
        </section>
        <section className="panel"><div className="section-heading"><div><h2 id="delivery-method">Delivery method</h2><p>Choose the default view for project work. Both approaches share one backlog.</p></div></div>
          <div className="method-grid" role="radiogroup" aria-labelledby="delivery-method">
            {deliveryOptions.map(option => <label key={option.value} className={method === option.value ? "method-card picked" : "method-card"}>
              <input type="radio" name="delivery-method" checked={method === option.value} value={option.value} aria-label={option.label} onChange={() => update("method", option.value)} />
              <strong>{option.label}</strong><small>{option.description}</small>
            </label>)}
          </div>
        </section>
        <section className="panel"><div className="section-heading"><div><h2>Schedule & milestones</h2><p>Set indicative dates. You can refine your work items after approval.</p></div></div>
          <div className="field-grid"><label>Planned start <SmartDatePicker modelValue={startDate} ariaLabel="Planned start date" onChange={value => update("startDate", value)} /></label><label>Target completion <SmartDatePicker modelValue={endDate} ariaLabel="Target completion date" onChange={value => update("endDate", value)} min={startDate} /></label></div>
        </section>
      </div>
      <aside className="summary"><div className="panel summary-panel"><h2>Charter summary</h2><div className="preview"><span>Project</span><strong>{name||'Untitled project'}</strong><span>Delivery</span><strong>{method==='KANBAN'?'Kanban / Agile':'Waterfall / Phased'}</strong><span>Schedule</span><strong>{startDate||'TBD'} — {endDate||'TBD'}</strong></div><p className="notice">A separate reviewer must approve this charter before the project becomes active.</p><div className="charter-actions">
        <a className="pmo-control quiet" href={link("/projects")}>Cancel</a>
        <button type="submit" className="pmo-control primary" disabled={busy || name.trim().length < 2 || !liveMode || revisionLoading || Boolean(revise && !original)}>{busy?'Submitting…':'Submit project for approval'}</button>
      </div></div></aside>
    </form>}
  </main>
  );
}
