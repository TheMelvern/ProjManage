import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartDatePicker } from '../../../components/SmartDatePicker';
import { SmartSelect } from '../../../components/SmartSelect';
import { LeaveRecords, type LeaveRecord } from './LeaveRecords';
import './LeaveTracker.css';

const blank = { type: 'ANNUAL', startDate: '', endDate: '', reason: '', dayType: 'FULL' };
interface Balance {
  year: number;
  holidays: string[];
  remaining: Partial<Record<string, number>>;
  entitlement?: Partial<Record<string, number>>;
  used?: Partial<Record<string, number>>;
  note?: string;
}
interface Revision {
  id: string;
  kind: string;
  status: string;
  makerId: string;
  comment?: string;
  proposed?: Partial<typeof blank>;
}
interface Props { request?: string; revise?: string; isAdmin?: boolean; link: (path: string) => string }
const types = ['Annual', 'Medical', 'Emergency', 'Unpaid'].map(name => ({ value: name.toUpperCase(), label: name + ' leave' }));
const durations = [
  { value: 'FULL', label: 'Full working day(s)' },
  { value: 'AM', label: 'Morning half day (single date)' },
  { value: 'PM', label: 'Afternoon half day (single date)' },
];

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Operation failed');
}

function estimate({ startDate, endDate, dayType, type }: typeof blank, balance: Balance | null) {
  if (!startDate || !endDate) return null;
  const first = Date.parse(startDate);
  const last = Date.parse(endDate);
  const day = 86_400_000;
  if (last < first) return { error: 'End date must be on or after the start date.' };
  if (last - first > 60 * day) return { error: 'Contact HR for leave longer than 60 days.' };
  if (first !== last && dayType !== 'FULL') return { error: 'Half-day leave must start and end on the same date.' };
  if (!balance) return null;
  const holidays = new Set(balance.holidays);
  let count = 0;
  for (let stamp = first; stamp <= last; stamp += day) {
    const date = new Date(stamp);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(date.toISOString().slice(0, 10))) count++;
  }
  const days = dayType === 'FULL' ? count : count / 2;
  if (!days) return { error: 'Select at least one working day. Weekends and organization holidays are excluded.' };
  const remaining = balance.remaining[type];
  const year = String(balance.year);
  const inBalanceYear = startDate.startsWith(year) && endDate.startsWith(year);
  if (inBalanceYear && remaining !== undefined && days > remaining) return { error: 'This request exceeds your available leave balance.' };
  return { days, remaining: inBalanceYear && remaining !== undefined ? remaining - days : null };
}

export function LeaveTracker({ request, revise, isAdmin, link }: Props) {
  const [draft, setDraft] = useState(blank);
  const { type, startDate, endDate, reason, dayType } = draft;
  const [composeOpen, setComposeOpen] = useState(request === '1');
  const [original, setOriginal] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requests, setRequests] = useState<LeaveRecord[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [requestsError, setRequestsError] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [requestsRevision, refreshRequests] = useState(0);
  const [balanceRevision, refreshBalance] = useState(0);
  const preview = estimate(draft, balance);
  const previewError = preview?.error ?? '';
  const previewMessage = previewError || (preview?.days != null
    ? 'Uses ' + preview.days + ' working ' + (preview.days === 1 ? 'day' : 'days') +
      (preview.remaining == null ? '.' : ' \u00b7 ' + preview.remaining + ' days remaining if approved.') : '');

  function update(field: keyof typeof blank, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
  }

  function closeRequest() {
    if (busy) return;
    setComposeOpen(false);
    if (original) {
      setDraft(blank);
      setOriginal(null);
    }
  }

  function load() {
    refreshRequests(current => current + 1);
    refreshBalance(current => current + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setRequestsError('');
    void api.get<{ data: LeaveRecord[] }>('/leave/mine', { signal }).then(response => {
      if (!signal.aborted) setRequests(response.data.data);
    }).catch(() => {
      if (!signal.aborted) setRequestsError('Could not load your leave requests.');
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [requestsRevision]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setBalanceLoading(true);
    setBalanceError('');
    void api.get<{ data: Balance }>('/leave/balances', { signal }).then(response => {
      if (!signal.aborted) setBalance(response.data.data);
    }).catch(() => {
      if (!signal.aborted) setBalanceError('Could not load leave balances.');
    }).finally(() => {
      if (!signal.aborted) setBalanceLoading(false);
    });
    return () => controller.abort();
  }, [balanceRevision]);

  useEffect(() => { if (request === '1') setComposeOpen(true); }, [request]);

  useEffect(() => {
    if (!revise) return;
    const controller = new AbortController();
    const { signal } = controller;
    void api.get<{ data: Revision[] }>('/reviews', { params: { module: 'leave', id: revise }, signal }).then(({ data }) => {
      if (signal.aborted) return;
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
      const item = data.data.find(item => item.kind === 'LEAVE_REQUEST' && item.status === 'RETURNED' && item.makerId === userId);
      if (!item?.proposed) throw new Error('The returned leave request could not be loaded.');
      setOriginal(item);
      setDraft({ ...blank, ...item.proposed, dayType: item.proposed.dayType || 'FULL' });
      setComposeOpen(true);
    }).catch(failure => { if (!signal.aborted) setError(describe(failure)); });
    return () => controller.abort();
  }, [revise]);

  async function changeRequest(action: () => Promise<unknown>, message: string, done?: () => void) {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
      done?.();
      load();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (previewError || !startDate || !endDate || reason.trim().length < 3) return;
    void changeRequest(() => api.post('/leave', {
      type, startDate, endDate, dayType, reason: reason.trim(),
      ...(original ? { revisesRequestId: original.id } : {}),
    }), 'Request submitted for independent approval. Your balance is not reduced while pending.', () => {
      setDraft(current => ({ ...current, startDate: '', endDate: '', reason: '' }));
      setOriginal(null);
      setComposeOpen(false);
    });
  }

  function cancelRequest(item: LeaveRecord) {
    if (busy || !window.confirm('Cancel this pending leave request?')) return;
    void changeRequest(() => api.post('/leave/' + encodeURIComponent(item.id) + '/cancel'),
      'Your pending leave request has been cancelled.');
  }

  return (
    <main className="leave-screen operational-page">
      <header className="header operational-heading">
        <div><h1>Leave tracker</h1><p>Request leave, track decisions and check your organization’s policy.</p></div>
        <button type="button" className="pmo-control primary" onClick={() => setComposeOpen(true)}>Request leave</button>
      </header>
      {error && <p className="message error" role="alert">{error}</p>}
      {success && <p className="message" role="status">{success}</p>}
      <div className="summary">
        <section><span>Annual leave available</span><strong>{balance?.remaining.ANNUAL ?? '—'}</strong>
          <small>{balance?.entitlement?.ANNUAL != null ? (balance.used?.ANNUAL ?? '—') + ' used of ' + balance.entitlement.ANNUAL + ' days' : 'Weekdays remaining this year'}</small></section>
        <section><span>Medical leave available</span><strong>{balance?.remaining.MEDICAL ?? '—'}</strong><small>Approved entitlement remaining</small></section>
      </div>
      {balanceLoading && <p role="status">Updating leave balances…</p>}
      {balanceError && <p role="alert">{balanceError}{balance ? ' Showing the last available balance.' : ''} <button type="button" className="pmo-control" onClick={() => refreshBalance(current => current + 1)}>Retry balances</button></p>}
      <PremiumComposeDialog open={composeOpen} title="New leave request" eyebrow="PEOPLE / LEAVE"
        description="Choose your dates and prepare a clear handover before requesting approval." error={error} onClose={closeRequest}
        footer={<>
          <button type="button" className="pmo-control" disabled={busy} onClick={closeRequest}>Cancel</button>
          <button type="submit" form="leave-request-form" className="pmo-control primary" disabled={busy || !startDate || !endDate || reason.trim().length < 3 || Boolean(previewError)}>{busy ? 'Submitting…' : 'Submit for review'}</button>
        </>}>
        {original && <p className="notice">Revising a returned request. {original.comment && <strong>Checker: {original.comment}</strong>}</p>}
        <form id="leave-request-form" onSubmit={submit}>
          <label htmlFor="leave-type">Leave type</label>
          <SmartSelect id="leave-type" ariaLabel="Leave type" modelValue={type} options={types} onChange={value => update('type', String(value))} />
          <div className="date-grid">
            <div><label htmlFor="leave-start">Start date</label><SmartDatePicker id="leave-start" modelValue={startDate} ariaLabel="Start date" required onChange={value => update('startDate', value)} /></div>
            <div><label htmlFor="leave-end">End date</label><SmartDatePicker id="leave-end" modelValue={endDate} ariaLabel="End date" min={startDate} required onChange={value => update('endDate', value)} /></div>
          </div>
          <label htmlFor="leave-day-type">Leave duration</label>
          <SmartSelect id="leave-day-type" modelValue={dayType} ariaLabel="Leave duration" options={durations} onChange={value => update('dayType', String(value))} />
          <label htmlFor="leave-reason">Reason and handover (required)</label>
          <p id="leave-reason-help">Use 3–500 characters. Include coverage details where relevant.</p>
          <textarea id="leave-reason" aria-describedby="leave-reason-help" value={reason} onChange={event => update('reason', event.target.value)}
            rows={4} minLength={3} maxLength={500} required placeholder="Reason and coverage plan" />
          {previewMessage && <p role="status">{previewMessage}</p>}
        </form>
      </PremiumComposeDialog>
      <LeaveRecords records={requests ?? []} balances={balance} loaded={Boolean(requests)} loading={loading}
        recordsError={requestsError} busy={busy} isAdmin={isAdmin} link={link} onRefresh={load} onCancel={cancelRequest} />
    </main>
  );
}
