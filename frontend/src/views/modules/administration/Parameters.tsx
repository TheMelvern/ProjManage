import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartSelect } from '../../../components/SmartSelect';
import './Parameters.css';

const settings = [
{key:'timezone',name:'Organization time zone'},{key:'currency',name:'Reporting currency'},
{key:'dateFormat',name:'Date display format'},{key:'fiscalYearStart',name:'Fiscal year start'},
{key:'leaveApprovalSlaDays',name:'Leave approval SLA (days)'},
{key:'leaveAnnualEntitlement',name:'Annual leave entitlement (days)'},
{key:'leaveMedicalEntitlement',name:'Medical leave entitlement (days)'},
{key:'leavePublicHolidays',name:'Public holiday calendar (YYYY-MM-DD, comma-separated)'},
{key:'claimCurrency',name:'Expense claim currency (MYR, SGD, USD, EUR, GBP, AUD)'},
{key:'claimMaximum',name:'Maximum amount per claim (0 for no limit)'},
{key:'riskEscalationThreshold',name:'Risk escalation severity'},
{key:'sessionTimeoutMinutes',name:'Session idle timeout (minutes)'}
];

interface ApprovedParameter { key: string; value: unknown }
const timeZones = ['UTC', ...(Intl.supportedValuesOf?.('timeZone') ?? [])];

function groupFor(key: string) {
  if (key.startsWith('leave')) return 'Leave';
  if (key.startsWith('claim')) return 'Expense claims';
  if (['currency', 'fiscalYearStart', 'riskEscalationThreshold'].includes(key)) return 'Reporting & risk';
  return 'Organization';
}

function validTimeZone(value: string) {
  if (!/^(UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/i.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Unexpected error');
}

export function Parameters({ hr = false }: { hr?: boolean }) {
  const allowed = settings.filter(item => /^(leave|claim)/.test(item.key) === hr);
  const [key, setKey] = useState(allowed[0].key);
  const [value, setValue] = useState('');
  const [summary, setSummary] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ApprovedParameter[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const activeLoad = useRef<AbortController | null>(null);
  const timezone = key === 'timezone';
  const invalidTimeZone = timezone && value.trim() !== '' && !validTimeZone(value.trim());
  const canSubmit = Boolean(value.trim() && summary.trim() && !invalidTimeZone);
  const approved = new Map(rows.map(row => [row.key, String(row.value)]));
  const groupNames = hr ? ['Leave', 'Expense claims'] : ['Organization', 'Reporting & risk'];
  const groups = groupNames.map(name => ({
    name,
    items: allowed.filter(item => groupFor(item.key) === name && item.name.toLowerCase().includes(query.trim().toLowerCase())),
  })).filter(group => group.items.length);

  const load = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    const { signal } = controller;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: ApprovedParameter[] }>('/admin/parameters', { signal });
      if (!signal.aborted) setRows(response.data.data);
    } catch (failure) {
      if (!signal.aborted) setError(describe(failure));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => activeLoad.current?.abort();
  }, [load]);

  function select(next: string) {
    if (next !== key) setValue('');
    setKey(next);
  }

  function close() {
    if (!submitting.current) setComposeOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !canSubmit) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/admin/parameters/proposals', { key, value: value.trim(), summary: summary.trim() });
      setNotice('Change request created. Track it in Admin approvals or My work.');
      setValue('');
      setSummary('');
      setComposeOpen(false);
      await load();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="admin-page operational-page">
      <header className="operational-heading"><div>
        <h1>{hr ? 'HR setup' : 'Admin Parameters'}</h1>
        <p>{hr ? 'Manage leave entitlements, holidays, and expense claim policy.' : 'Manage organization, reporting, and security settings.'}</p>
      </div></header>
      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message" role="status">{notice}</p>}
      <section className="work-panel settings-catalogue" aria-labelledby="catalogue-title">
        <header className="work-toolbar"><div>
          <h2 id="catalogue-title">{hr ? 'HR policy' : 'Organization settings'}</h2>
          <p>Changes take effect after independent approval.</p>
        </div></header>
        <div className="work-toolbar work-filters filter-toolbar">
          <label htmlFor="parameter-search">Search settings
            <input id="parameter-search" value={query} type="search" placeholder="Find a setting" onChange={event => setQuery(event.target.value)} />
          </label>
          {query && <button className="pmo-control quiet" type="button" onClick={() => setQuery('')}>Clear search</button>}
        </div>
        {loading ? <p className="work-panel-empty" role="status">Loading approved settings{'\u2026'}</p>
          : groups.length === 0 && <p className="work-panel-empty">No settings match your search.</p>}
        {groups.map(group => <section key={group.name} className="settings-group">
          <h3>{group.name}</h3>
          <ul>{group.items.map(setting => <li key={setting.key}>
            <div><strong>{setting.name}</strong><small>{loading ? 'Loading approved value\u2026' : approved.get(setting.key) ?? 'No approved override'}</small></div>
            <button type="button" className="pmo-control quiet" aria-label={'Propose change to ' + setting.name}
              onClick={() => { select(setting.key); setComposeOpen(true); }}>Propose change</button>
          </li>)}</ul>
        </section>)}
        <PremiumComposeDialog open={composeOpen} title={hr ? 'Change HR policy' : 'Change organization parameter'}
          eyebrow="ADMINISTRATION / PARAMETERS" description="Review the current approved value, enter a proposed value, and explain the reason."
          error={error} onClose={close} footer={<>
            <button type="button" className="pmo-control quiet" disabled={busy} onClick={close}>Cancel</button>
            <button type="submit" form="parameter-proposal-form" className="pmo-control primary" disabled={busy || !canSubmit}>{busy ? 'Submitting\u2026' : 'Submit for check'}</button>
          </>}>
          <form id="parameter-proposal-form" onSubmit={submit}>
            <label htmlFor="param-key">Parameter</label>
            <SmartSelect id="param-key" modelValue={key} ariaLabel="Parameter"
              options={allowed.map(item => ({ value: item.key, label: item.name }))} onChange={next => select(String(next))} />
            <label htmlFor="param-current">Current approved value</label>
            <input id="param-current" readOnly value={approved.get(key) ?? ''} placeholder="Not configured" />
            <label htmlFor="param-new">Proposed value</label>
            <input id="param-new" value={value} onChange={event => setValue(event.target.value)}
              maxLength={key === 'leavePublicHolidays' ? 2000 : 120} required list={timezone ? 'time-zones' : undefined}
              aria-describedby={timezone ? 'time-zone-help' : undefined} aria-invalid={invalidTimeZone || undefined} />
            <datalist id="time-zones">{timeZones.map(zone => <option key={zone} value={zone} />)}</datalist>
            {timezone && <p id="time-zone-help" role={invalidTimeZone ? 'status' : undefined}>{invalidTimeZone
              ? 'Enter a valid time zone, such as Asia/Kuala_Lumpur.' : 'Search by region or city, or enter UTC.'}</p>}
            <label htmlFor="param-summary">Change rationale (required)</label>
            <textarea id="param-summary" value={summary} onChange={event => setSummary(event.target.value)} required
              maxLength={400} rows={3} placeholder="Why is this parameter being changed?" />
          </form>
        </PremiumComposeDialog>
      </section>
    </main>
  );
}
