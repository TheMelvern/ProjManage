import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { FilterSummary } from '../../../components/FilterSummary';
import { PortfolioSnapshot } from '../../../components/PortfolioSnapshot';
import { SmartSelect } from '../../../components/SmartSelect';
import type { Snapshot } from '../../../utils/portfolioSnapshot';
import './ReviewCenter.css';

const kindGroups={
  projects:['PROJECT_CREATE','PROJECT_UPDATE','TASK_CREATE','TASK_UPDATE'],
  raid:['RISK_CREATE','RISK_UPDATE','ISSUE_CREATE','ISSUE_UPDATE','DECISION_CREATE','ACTION_CREATE','ACTION_UPDATE'],
  timesheets:['TIMESHEET_CREATE'],reports:['REPORT_PUBLISH'],leave:['LEAVE_REQUEST'],claims:['CLAIM_REQUEST'],
  admin:['REGISTRATION','PARAMETER_UPDATE','MEMBERSHIP_UPDATE']
};

export type ReviewModule = keyof typeof kindGroups;
const moduleLabels: Record<ReviewModule, string> = {
  projects: 'Project', raid: 'RAID', timesheets: 'Timesheet', reports: 'Report',
  leave: 'Leave', claims: 'Claim', admin: 'Administration',
};
interface Review {
  id: string;
  kind: string;
  status: string;
  summary: string;
  makerId?: string;
  makerName?: string;
  checkerName?: string;
  comment?: string;
  entityId?: string;
  createdAt?: string;
  reviewedAt?: string;
  proposed?: {
    values?: Record<string, unknown>;
    projectId?: string;
    targetId?: string;
    revisesRequestId?: string;
    snapshot?: Snapshot;
    [key: string]: unknown;
  };
}
interface Props {
  module: ReviewModule;
  requestedId?: string;
  scopeQuery?: string;
  userId?: string;
  role?: string;
  link: (path: string) => string;
  requestLink: (id: string) => string;
}
const statuses = [
  { value: 'PENDING', label: 'Pending review' }, { value: 'RETURNED', label: 'Returned' },
  { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' },
];
const scopes = [
  { value: 'ALL', label: 'All requests' }, { value: 'MINE', label: 'My requests' }, { value: 'CHECK', label: 'Needs my review' },
];
const fields: Partial<Record<string, string>> = {
  name: 'Project name', client: 'Client / business unit', startDate: 'Planned start', targetEndDate: 'Target completion',
  description: 'Overview and outcome', deliveryMethod: 'Delivery method',
};
const ignored = new Set(['snapshot', 'targetId', 'projectId', 'previousUpdatedAt', 'revisesRequestId', 'amountMinor']);
const labelKind = (value: unknown) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const timeLabel = (value?: string) => value ? new Date(value).toLocaleString() : 'Date unavailable';

function valueLabel(key: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (key === 'deliveryMethod' && value === 'KANBAN') return 'Agile · Kanban';
  if (key === 'deliveryMethod' && value === 'WATERFALL') return 'Waterfall · Phases';
  const text = String(value);
  return /date$/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Request failed');
}

export function ReviewCenter({ module, requestedId, scopeQuery, userId, role, link, requestLink }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [comment, setComment] = useState('');
  const [scope, setScope] = useState(scopeQuery === 'MINE' || scopeQuery === 'CHECK' ? scopeQuery : 'ALL');
  const [filter, setFilter] = useState('ALL');
  const [revision, refresh] = useState(0);
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const updating = useRef(false);
  const selected = reviews.find(review => review.id === requestedId);
  const selectedId = selected?.id;
  const selectedKind = selected?.kind;
  const selectedStatus = selected?.status;
  const targetId = selected?.proposed?.targetId;
  const projectId = selected?.proposed?.projectId || (selectedKind === 'PROJECT_UPDATE' ? selected?.entityId : undefined);
  const values = selected?.proposed?.values ?? Object.fromEntries(Object.entries(selected?.proposed ?? {}).filter(([key]) => !ignored.has(key)));
  const details = Object.entries(values).filter(([, value]) =>
    value !== '' && ['string', 'number', 'boolean'].includes(typeof value));
  const name = selected?.proposed?.values?.name;
  const requestTitle = selectedKind === 'REPORT_PUBLISH' ? 'Executive snapshot request'
    : (selectedKind === 'PROJECT_CREATE' || selectedKind === 'PROJECT_UPDATE') && typeof name === 'string' && name
      ? name + ' · Project request' : selected?.summary || 'Approval request';
  const base = '/' + module + '/approvals';
  const reviewable = (review?: Review) => review?.status === 'PENDING' && Boolean(userId) &&
    review.makerId !== userId && ['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(role ?? '') &&
    (!['admin', 'claims'].includes(module) || role === 'ADMIN') &&
    (review.kind !== 'REPORT_PUBLISH' || (role !== 'PROJECT_MANAGER' && Boolean(review.proposed?.snapshot)));
  const scoped = reviews.filter(review => scope === 'ALL' || (scope === 'MINE' ? review.makerId === userId : reviewable(review)));
  const visible = scoped.filter(review => filter === 'ALL' || review.status === filter);
  const revisionPath = selectedStatus === 'RETURNED' && selected?.makerId === userId ?
    (selectedKind === 'PROJECT_CREATE' ? '/projects/new' : selectedKind === 'LEAVE_REQUEST' ? '/leave' : '') : '';
  const chips = [
    ...(scope === 'ALL' ? [] : [{ key: 'scope', label: 'Request scope', value: scope === 'MINE' ? 'My requests' : 'Needs my review' }]),
    ...(filter === 'ALL' ? [] : [{ key: 'status', label: 'Status', value: labelKind(filter) }]),
  ];

  useEffect(() => {
    if (scopeQuery && scopes.some(item => item.value === scopeQuery)) setScope(scopeQuery);
  }, [scopeQuery]);

  useEffect(() => {
    setComment('');
    setNotice('');
  }, [requestedId, module]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const { data } = await api.get<{ data: Review[] }>('/reviews', { params: { module }, signal });
        const rows = data.data.filter(row => kindGroups[module].includes(row.kind));
        if (requestedId && !rows.some(row => row.id === requestedId)) {
          const response = await api.get<{ data: Review[] }>('/reviews', { params: { module, id: requestedId }, signal });
          const detail = response.data.data[0];
          if (detail && kindGroups[module].includes(detail.kind)) rows.push(detail);
        }
        if (!signal.aborted) setReviews(rows);
      } catch (failure) {
        if (!signal.aborted) setError(describe(failure));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [module, requestedId, revision]);

  useEffect(() => {
    setCurrent(null);
    if (selectedId) heading.current?.focus();
    if (!projectId || selectedStatus !== 'PENDING' || !['PROJECT_UPDATE', 'TASK_UPDATE'].includes(selectedKind ?? '')) return;
    const controller = new AbortController();
    const { signal } = controller;
    const path = '/projects/' + encodeURIComponent(projectId);
    if (selectedKind === 'TASK_UPDATE') {
      void api.get<{ data: (Record<string, unknown> & { id: string })[] }>(path + '/tasks', { signal }).then(({ data }) => {
        if (!signal.aborted) setCurrent(data.data.find(task => task.id === targetId) ?? null);
      }).catch(() => { /* Proposed values remain available. */ });
    } else {
      void api.get<{ data: Record<string, unknown> }>(path, { signal }).then(({ data }) => {
        if (!signal.aborted) setCurrent(data.data);
      }).catch(() => { /* Proposed values remain available. */ });
    }
    return () => controller.abort();
  }, [selectedId, selectedStatus, selectedKind, projectId, targetId]);

  async function decide(decision: 'APPROVED' | 'RETURNED' | 'REJECTED') {
    if (!selected || !reviewable(selected) || updating.current) return;
    if (decision !== 'APPROVED' && !comment.trim()) {
      setError('A comment is required for rejection or return.');
      return;
    }
    updating.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post('/reviews/' + encodeURIComponent(selected.id) + '/decision', { decision, comment: comment.trim() });
      setNotice('Review marked ' + decision.toLowerCase() + '.');
      setComment('');
      setCurrent(null);
      setReviews(rows => rows.map(review => review.id === selected.id ? { ...review, status: decision } : review));
      refresh(value => value + 1);
    } catch (failure) {
      setError(describe(failure));
    } finally {
      updating.current = false;
      setBusy(false);
    }
  }

  return <main className={requestedId ? 'review-page operational-page with-request' : 'review-page operational-page'}>
    <header className="review-heading operational-heading">
      <div>
        {requestedId && <a className="approval-back" href={link(base)}>
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span> Back to approvals</a>}
        <h1 ref={heading} tabIndex={-1}>{requestedId ? requestTitle : moduleLabels[module] + ' approvals'}</h1>
        {selected && <div className="request-context"><span className="record-state" data-state={selected.status}>{labelKind(selected.status)}</span>
          {selected.status === 'PENDING' && <span>Awaiting independent review</span>}</div>}
        {!requestedId && <p>Review requests and decisions for this module.</p>}
      </div>
      <button type="button" className="pmo-control quiet" disabled={loading} onClick={() => refresh(value => value + 1)}>{requestedId ? 'Refresh request' : 'Refresh queue'}</button>
    </header>
    {error && <p className="feedback error" role="alert">{error}</p>}
    {notice && <p className="feedback" role="status">{notice}</p>}
    {!requestedId && <section className="approval-totals" aria-label="Filter by approval status">
      {statuses.map(item => <button key={item.value} type="button" className="approval-total"
        aria-pressed={filter === item.value} onClick={() => setFilter(filter === item.value ? 'ALL' : item.value)}>
        <span>{item.label}</span><strong>{(loading || error) && reviews.length === 0 ? '—' : scoped.filter(review => review.status === item.value).length}</strong>
      </button>)}
    </section>}
    <section className={requestedId ? 'review-card queue adjacent-queue' : 'review-card queue'}>
      <div className="section-title"><h2>Requests</h2></div>
      <div className="filter-toolbar" role="group" aria-label="Request filters">
        <SmartSelect modelValue={scope} filterLabel="View" ariaLabel="Request scope" options={scopes} onChange={value => setScope(String(value))} />
        <SmartSelect modelValue={filter} filterLabel="Status" ariaLabel="Approval status filter"
          options={[{ value: 'ALL', label: 'All statuses' }, ...statuses.map(item => ({ value: item.value, label: labelKind(item.value) }))]}
          onChange={value => setFilter(String(value))} />
      </div>
      {!loading && (!error || reviews.length > 0) && <FilterSummary chips={chips} count={visible.length} total={reviews.length}
        noun="requests" onRemove={key => key === 'scope' ? setScope('ALL') : setFilter('ALL')}
        onClear={() => { setScope('ALL'); setFilter('ALL'); }} />}
      {loading ? <div role="status">Loading review requests…</div>
        : error && reviews.length === 0 ? <div className="empty">Use Refresh queue to try again.</div>
        : visible.length === 0 ? <div className="empty">{scope === 'CHECK' && filter === 'ALL' ? 'No requests need your review.'
          : scope === 'MINE' && filter === 'ALL' ? 'You have no requests in this queue.' : 'No requests match this view.'}</div>
        : <div role="region" aria-label="Approval requests"><ul className="approval-list record-list">
          {visible.map(review => <li key={review.id}><a className="approval-row record-row" aria-current={requestedId === review.id ? 'page' : undefined}
            href={requestLink(review.id)}>
            <span className="approval-avatar" aria-hidden="true">{review.makerName?.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'RQ'}</span>
            <span className="approval-record"><strong>{review.summary}</strong>
              <small>{labelKind(review.kind)} · {review.makerName || 'Applicant'} · {review.id.slice(0, 8)}</small>
              {review.checkerName && <small>Reviewed by {review.checkerName}</small>}
            </span>
            <span className="record-state" data-state={review.status}>{labelKind(review.status)}</span>
            <span className="approval-open">{reviewable(review) ? 'Review' : 'View request'}</span>
            <span className="material-symbols-outlined approval-arrow" aria-hidden="true">chevron_right</span>
          </a></li>)}
        </ul></div>}
    </section>
    {!requestedId && <details className="review-policy"><summary>How approvals work</summary>
      <p>An authorized checker reviews each request independently. Decisions are recorded in the audit history.</p></details>}
    {requestedId && loading && <p role="status">Loading request…</p>}
    {requestedId && !loading && !error && !selected && <p role="status">This request is unavailable. <a href={link(base)}>Back to approvals</a></p>}
    {requestedId && selected && <div className="approval-detail-stack">
      <section id="review-detail" className="review-card approval-detail" aria-labelledby="review-title">
        <div className="section-title"><h2 id="review-title">Request details <small>· {selected.id.slice(0, 8)}</small></h2></div>
        {selected.summary !== requestTitle && <p>{selected.summary}</p>}
        {selected.comment && <p className="decision-note"><strong>Checker comment</strong><br />{selected.comment}</p>}
        {selected.proposed?.revisesRequestId && <a className="pmo-control quiet" href={link(base + '/' + encodeURIComponent(selected.proposed.revisesRequestId))}>View original request</a>}
        {revisionPath && <a className="pmo-control primary" href={link(revisionPath + '?revise=' + encodeURIComponent(selected.id))}>Revise and resubmit</a>}
        <div className="approval-record-links">
          {projectId && <a className="pmo-control quiet" href={link('/projects/' + encodeURIComponent(projectId) + '/workspace')}>Open project</a>}
          {role === 'ADMIN' && <a className="pmo-control quiet" href={link('/admin/audit?ref=' + encodeURIComponent(selected.id))}>View audit history</a>}
        </div>
        <p className="approval-participants">Submitted by {selected.makerName || 'Applicant'} · {timeLabel(selected.createdAt)}
          {selected.reviewedAt && <><br />Reviewed by {selected.checkerName || 'Checker'} · {timeLabel(selected.reviewedAt)}</>}</p>
        {details.length > 0 && (current ? <section className="approval-comparison" aria-label="Proposed versus current values">
          <h3>Compare changes</h3><dl>{details.map(([key, value]) => <div key={key}>
            <dt>{fields[key] || labelKind(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}</dt>
            <dd><small>Current approved value</small>{valueLabel(key, current[key])}</dd>
            <dd><small>Proposed value</small>{valueLabel(key, value)}</dd>
          </div>)}</dl>
        </section> : <dl className="review-details">{details.map(([key, value]) => <div key={key}>
          <dt>{fields[key] || labelKind(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}</dt><dd>{valueLabel(key, value)}</dd>
        </div>)}</dl>)}
        {selectedKind === 'REPORT_PUBLISH' && (selected.proposed?.snapshot
          ? <PortfolioSnapshot data={selected.proposed.snapshot} title="Frozen executive snapshot" />
          : <p role="alert">The submitted snapshot is unavailable.</p>)}
        {selectedKind === 'REGISTRATION' && <p className="info">Registration details are redacted until account approval. Password hashes are never returned by this API.</p>}
      </section>
      {reviewable(selected) ? <section className="review-card decision" aria-labelledby="decision-title">
        <h2 id="decision-title">Record a decision</h2><p>Include a reason when returning or rejecting a request.</p>
        <label htmlFor="review-comment">Decision comment</label>
        <textarea id="review-comment" value={comment} onChange={event => setComment(event.target.value)} rows={3} maxLength={1000}
          placeholder="Reason for rejection / return or review notes" />
        <div className="review-actions">
          <button type="button" className="pmo-control primary" disabled={busy} onClick={() => decide('APPROVED')}>Approve</button>
          <button type="button" className="pmo-control" disabled={busy} onClick={() => decide('RETURNED')}>Return to maker</button>
          <button type="button" className="pmo-control danger" disabled={busy} onClick={() => decide('REJECTED')}>Reject</button>
        </div>
      </section> : selected.makerId && selected.makerId === userId && <p className="approval-guidance">
        You submitted this change. Another authorized checker must review it.</p>}
    </div>}
  </main>;
}
