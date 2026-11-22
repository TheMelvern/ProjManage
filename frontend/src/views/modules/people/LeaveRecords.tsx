import { useState } from 'react';
import { FilterSummary } from '../../../components/FilterSummary';
import { SmartSelect } from '../../../components/SmartSelect';
import './LeaveRecords.css';

export interface LeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  dayType: string;
  status: string;
  createdAt: string;
  reason?: string | null;
  checkerId?: string | null;
}

interface Props {
  records: readonly LeaveRecord[];
  balances?: { note?: string } | null;
  loaded?: boolean;
  loading?: boolean;
  recordsError?: string;
  busy?: boolean;
  isAdmin?: boolean;
  link: (path: string) => string;
  onRefresh: () => void;
  onCancel: (record: LeaveRecord) => void;
}

function label(value: string) {
  return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/^./, char => char.toUpperCase());
}

const types = [{ value: '', label: 'All types' }, ...['ANNUAL', 'MEDICAL', 'EMERGENCY', 'UNPAID'].map(value => ({ value, label: label(value) }))];
const statuses = [{ value: '', label: 'All statuses' }, ...['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'].map(value => ({ value, label: label(value) }))];
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function formatDate(value: string) {
  return value ? dateFormat.format(new Date(value)) : '\u2014';
}

function dates(start: string, end: string) {
  return start === end ? formatDate(start) : formatDate(start) + ' \u2013 ' + formatDate(end);
}

function download(records: readonly LeaveRecord[]) {
  const headers = ['Request ID', 'Type', 'Start', 'End', 'Day Type', 'Status', 'Submitted'];
  const rows = records.map(record => [record.id, record.type, record.startDate, record.endDate, record.dayType, record.status, record.createdAt]);
  const csv = [headers, ...rows].map(row => row.map(value => {
    const text = String(value ?? '');
    return '"' + (/^[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'pmo-personal-leave-' + new Date().toISOString().slice(0, 10) + '.csv';
  anchor.click();
  URL.revokeObjectURL(href);
}

export function LeaveRecords({ records, balances, loaded, loading, recordsError, busy, isAdmin, link, onRefresh, onCancel }: Props) {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const filtered = Boolean(type || status);
  const visible = records.filter(record => (!type || record.type === type) && (!status || record.status === status));
  const chips = [
    ...(type ? [{ key: 'type', label: 'Leave type', value: label(type) }] : []),
    ...(status ? [{ key: 'status', label: 'Status', value: label(status) }] : []),
  ];

  return (
    <div className="leave-records" style={{ display: 'contents' }}>
      <section className="ledger-panel" aria-labelledby="leave-history-title">
        <header className="ledger-panel-heading">
          <div><h2 id="leave-history-title">Request history {records.length > 0 && <span className="pmo-status">{records.length}</span>}</h2>
            <p>Pending requests affect your balance after approval.</p></div>
          <div className="ledger-actions">
            <button type="button" className="pmo-control refresh-ledger" disabled={loading} onClick={onRefresh}>
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>{loading ? 'Refreshing\u2026' : 'Refresh'}
            </button>
            {visible.length > 0 && <button type="button" className="pmo-control" onClick={() => download(visible)}>
              <span className="material-symbols-outlined" aria-hidden="true">download</span>Export CSV
            </button>}
          </div>
        </header>
        {loading && <p className="ledger-feedback" role="status">{loaded ? 'Refreshing requests\u2026' : 'Loading your requests\u2026'}</p>}
        {recordsError && <p className="ledger-feedback ledger-alert" role="alert">{recordsError}{loaded ? ' Showing your last available requests.' : ' Use Refresh to try again.'}</p>}
        {records.length > 0 && <div className="ledger-filters filter-toolbar" role="group" aria-label="Filter requests">
          <SmartSelect modelValue={type} filterLabel="Leave type" ariaLabel="Leave type filter" options={types} onChange={value => setType(String(value))} />
          <SmartSelect modelValue={status} filterLabel="Status" ariaLabel="Leave status filter" options={statuses} onChange={value => setStatus(String(value))} />
        </div>}
        {!loading && !recordsError && records.length > 0 && <FilterSummary chips={chips} count={visible.length}
          total={records.length} noun="requests" onRemove={key => key === 'type' ? setType('') : setStatus('')}
          onClear={() => { setType(''); setStatus(''); }} />}
        {visible.length > 0 ? <div className="ledger-scroll" tabIndex={0} role="region" aria-label="Leave request history table">
          <table>
            <thead><tr>{['Leave type', 'Dates', 'Duration', 'Status', 'Submitted', 'Actions'].map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
            <tbody>{visible.map(record => <tr key={record.id}>
              <th scope="row"><strong>{label(record.type)} leave</strong><small>Ref {record.id.slice(0, 8)}</small></th>
              <td data-label="Dates">{dates(record.startDate, record.endDate)}</td>
              <td data-label="Duration">{record.dayType === 'AM' ? 'Morning half-day' : record.dayType === 'PM' ? 'Afternoon half-day' : 'Full day'}</td>
              <td data-label="Status"><span className="record-state" data-state={record.status}>{label(record.status)}</span></td>
              <td data-label="Submitted">{formatDate(record.createdAt)}</td>
              <td className="ledger-row-actions">
                {record.status === 'RETURNED' && <a className="pmo-control quiet" href={link('/leave/approvals/' + encodeURIComponent(record.id))}>View decision</a>}
                {record.status === 'PENDING' && <button type="button" className="pmo-control quiet" disabled={busy} onClick={() => onCancel(record)}>Cancel pending request</button>}
                {(record.reason || record.checkerId) && <details>
                  <summary>Request details</summary>
                  {record.reason && <p>{record.reason}</p>}
                  {record.checkerId && <small>Checker reference {record.checkerId.slice(0, 8)}</small>}
                </details>}
              </td>
            </tr>)}</tbody>
          </table>
        </div> : loaded && !loading && !recordsError && <div className="ledger-empty">
          <span className="material-symbols-outlined record-icon" aria-hidden="true">{filtered ? 'filter_list_off' : 'event_note'}</span>
          <div><h3>{filtered ? 'No requests match these filters' : 'No leave requests yet'}</h3>
            <p>{filtered ? 'Change the filters to see more requests.' : 'Your requests and their approval status will appear here.'}</p></div>
        </div>}
      </section>
      <aside className="ledger-policy" aria-labelledby="leave-policy-title">
        <span className="material-symbols-outlined record-icon" aria-hidden="true">policy</span>
        <div><h2 id="leave-policy-title">Organization policy</h2>
          <p>{balances?.note || 'Leave entitlements and holidays follow your organization\u2019s policy.'}</p>
          {isAdmin && <a className="policy-link" href={link('/people/setup')}>Manage leave policy</a>}
        </div>
      </aside>
    </div>
  );
}
