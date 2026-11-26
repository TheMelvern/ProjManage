import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { FilterSummary } from '../../../components/FilterSummary';
import { SmartSelect } from '../../../components/SmartSelect';
import api from '../../../api/axiosConfig';
import './AuditLog.css';

interface AuditEvent {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
  entityType: string;
  entityId: string;
}

const emptyFilters = { action: '', search: '', from: '', to: '' };
type Filter = keyof typeof emptyFilters;
const filterLabels: Record<Filter, string> = { action: 'Action', search: 'Search', from: 'From', to: 'To' };

function eventDay(value: string) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function initials(name: string) {
  return (name?.trim() || '?').split(/\s+/).slice(0, 2).map(word => word[0].toUpperCase()).join('');
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
}

export function AuditLog({ reference }: { reference?: string }) {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, search: reference ?? '' }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const activeLoad = useRef<AbortController | null>(null);

  async function load() {
    activeLoad.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    activeLoad.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: AuditEvent[] }>('/admin/audit', { signal });
      if (!signal.aborted) setRows(response.data.data);
    } catch (failure) {
      if (signal.aborted) return;
      const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
      setError((Array.isArray(message) ? message.join(', ') : message) ||
        (failure instanceof Error ? failure.message : 'Could not load audit records.'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => activeLoad.current?.abort();
  }, []);

  function updateFilter(key: Filter, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  const { action, search, from, to } = filters;
  const actions = [...new Set(rows.map(row => row.action))].sort();
  const query = search.trim().toLowerCase();
  const visible = rows.filter(row => {
    const day = eventDay(row.createdAt);
    return (!action || row.action === action) && (!from || day >= from) && (!to || day <= to) &&
      [row.actorName, row.action, row.entityType, row.entityId].join(' ').toLowerCase().includes(query);
  });
  const chips = (Object.keys(filterLabels) as Filter[]).map(key => ({
    key, label: filterLabels[key], value: key === 'action' ? humanize(action) : filters[key].trim(),
  })).filter(chip => chip.value);

  return (
    <main className="audit-screen operational-page">
      <header className="operational-heading">
        <div><h1>Audit &amp; Security</h1><p>Review approval decisions and administrative changes in your organization.</p></div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="card">
        <div className="head">
          <div><h2>Administrative audit history</h2><p>Audit events are read-only; each event identifies the actor, entity and timestamp.</p></div>
          <button type="button" className="pmo-control quiet" onClick={load}>Refresh</button>
        </div>
        <div className="controls filter-toolbar">
          <SmartSelect modelValue={action} filterLabel="Action" ariaLabel="Audit action filter"
            options={[{ value: '', label: 'All actions' }, ...actions.map(value => ({ value, label: humanize(value) }))]}
            onChange={value => updateFilter('action', String(value))} />
          <label>Search audit events <input value={search} placeholder="Find an event" onChange={event => updateFilter('search', event.target.value)} /></label>
          <label>From <input type="date" value={from} max={to || undefined} onChange={event => updateFilter('from', event.target.value)} /></label>
          <label>To <input type="date" value={to} min={from || undefined} onChange={event => updateFilter('to', event.target.value)} /></label>
        </div>
        {!loading && !error && <FilterSummary chips={chips} count={visible.length} total={rows.length} noun="events"
          onRemove={key => updateFilter(key as Filter, '')} onClear={() => setFilters(emptyFilters)} />}
        {loading ? <p role="status">Loading audit records{'\u2026'}</p> : (
          <div className="scroll" tabIndex={0} role="region" aria-label="Administrative audit events">
            <table>
              <thead><tr>{['Timestamp', 'Actor', 'Event', 'Entity', 'Reference'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {visible.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                    <td><span className="identity"><span className="badge">{initials(record.actorName)}</span>{record.actorName}</span></td>
                    <td><span className="action" title={record.action}>{humanize(record.action)}</span></td>
                    <td>{record.entityType}</td><td className="mono">{record.entityId.slice(0, 12)}{'\u2026'}</td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={5} className="empty">No matching audit events.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="disclaimer">Access restricted to administrators. Exporting audit records should follow organizational retention and privacy rules.</p>
      </section>
    </main>
  );
}
