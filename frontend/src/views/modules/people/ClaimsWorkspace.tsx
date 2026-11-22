import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { FilterSummary } from '../../../components/FilterSummary';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartSelect } from '../../../components/SmartSelect';

interface Claim {
  id: string;
  status: string;
  expense: { description: string; category: string; expenseDate: string; amountMinor: number; currency: string };
}
interface Policy { currency: string; maxMinor?: number; categories: string[] }
interface ClaimData { policy: Policy; claims: Claim[] }
interface Props {
  request?: string;
  clearRequest: () => void;
  link: (path: string) => string;
}

function label(value: string) {
  return value.toLowerCase().replace(/^./, char => char.toUpperCase());
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
}

const statusOptions = [{ value: '', label: 'All statuses' },
  ...['PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map(value => ({ value, label: label(value) }))];

export function ClaimsWorkspace({ request, clearRequest, link }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<ClaimData | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(request === '1');
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ category: 'TRAVEL', expenseDate: today, amount: '', description: '', receiptReference: '' });
  const activeLoad = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const policy = data?.policy;
  const claims = data?.claims ?? [];
  const visible = status ? claims.filter(item => item.status === status) : claims;

  useEffect(() => {
    if (request === '1') setComposeOpen(true);
  }, [request]);

  const load = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    activeLoad.current = controller;
    setLoading(true);
    setLoadError('');
    try {
      const result = await api.get<{ data: ClaimData }>('/claims', { signal });
      if (!signal.aborted) setData(result.data.data);
    } catch {
      if (!signal.aborted) setLoadError('Could not load your claims. Use Refresh to try again.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => activeLoad.current?.abort();
  }, [load]);

  function close() {
    if (submitting.current) return;
    setComposeOpen(false);
    setSubmitError('');
    clearRequest();
  }

  function update(field: keyof typeof draft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSubmitError('');
    try {
      const { amount, description, receiptReference, ...fields } = draft;
      await api.post('/claims', {
        ...fields, description: description.trim(), receiptReference: receiptReference.trim(),
        amountMinor: Math.round(Number(amount) * 100),
      });
      setDraft(current => ({ ...current, amount: '', description: '', receiptReference: '' }));
      setMessage('Claim submitted for independent review.');
      submitting.current = false;
      close();
      await load();
    } catch (failure) {
      const reason = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
      setSubmitError((Array.isArray(reason) ? reason.join(' ') : reason) || 'Could not submit the claim.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="operational-page claims-page">
      <header className="operational-heading">
        <div><h1>Expense claims</h1><p>Submit expenses and track their review.</p></div>
        <button type="button" className="pmo-control primary" disabled={!policy} onClick={() => setComposeOpen(true)}>New claim</button>
      </header>
      {message && <p role="status">{message}</p>}
      {loadError && <p role="alert">{loadError}</p>}
      <section className="work-panel claims-ledger">
        <header className="work-toolbar">
          <div><h2>My claims</h2>{policy && <p>{policy.currency}{policy.maxMinor ? ' \u00b7 Limit ' + money(policy.maxMinor, policy.currency) + ' per claim' : ''}</p>}</div>
          <button type="button" className="pmo-control quiet" disabled={loading} onClick={load}>Refresh</button>
        </header>
        {claims.length > 0 && <div className="filter-toolbar" role="group" aria-label="Claim filters">
          <SmartSelect modelValue={status} filterLabel="Status" ariaLabel="Claim status" options={statusOptions} onChange={value => setStatus(String(value))} />
        </div>}
        {!loading && !loadError && claims.length > 0 && <FilterSummary
          chips={status ? [{ key: 'status', label: 'Status', value: label(status) }] : []}
          count={visible.length} total={claims.length} noun="claims" onRemove={() => setStatus('')} onClear={() => setStatus('')} />}
        {loading ? <p className="work-panel-empty" role="status">Loading claims{'\u2026'}</p>
          : !loadError && visible.length === 0 ? <p className="work-panel-empty">{status
            ? 'No claims match this status.' : 'No claims yet. Submit a claim to send it for independent review.'}</p>
          : <ul className="claims-list record-list">{visible.map(claim => <li key={claim.id}>
            <a className="record-row" href={link('/claims/approvals/' + encodeURIComponent(claim.id))}>
              <span><strong>{claim.expense.description}</strong><small>{label(claim.expense.category)} {'\u00b7'} {claim.expense.expenseDate}</small></span>
              <b>{money(claim.expense.amountMinor, claim.expense.currency)}</b>
              <span className="record-state" data-state={claim.status}>{label(claim.status)}</span>
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </a>
          </li>)}</ul>}
      </section>
      {policy && <PremiumComposeDialog open={composeOpen} title="New expense claim"
        description="An independent administrator reviews the claim before it is approved." error={submitError} onClose={close}
        footer={<>
          <button type="button" className="pmo-control quiet" disabled={busy} onClick={close}>Cancel</button>
          <button type="submit" form="claim-form" className="pmo-control primary" disabled={busy}>{busy ? 'Submitting\u2026' : 'Submit for review'}</button>
        </>}>
        <form id="claim-form" className="claim-form" onSubmit={submit}>
          <label>Category <SmartSelect modelValue={draft.category} ariaLabel="Expense category"
            options={policy.categories.map(value => ({ value, label: label(value) }))} onChange={value => update('category', String(value))} /></label>
          <label>Expense date <input value={draft.expenseDate} onChange={event => update('expenseDate', event.target.value)} type="date" max={today} required /></label>
          <label>Amount ({policy.currency}) <input value={draft.amount} onChange={event => update('amount', event.target.value)}
            type="number" inputMode="decimal" step="0.01" min="0.01" max={(policy.maxMinor || 99999999) / 100} required /></label>
          <label>Receipt reference <input value={draft.receiptReference} onChange={event => update('receiptReference', event.target.value)}
            maxLength={120} placeholder="Optional receipt or invoice number" /></label>
          <label className="claim-description">Description <textarea value={draft.description} onChange={event => update('description', event.target.value)}
            minLength={3} maxLength={500} rows={3} required /></label>
        </form>
      </PremiumComposeDialog>}
    </main>
  );
}
