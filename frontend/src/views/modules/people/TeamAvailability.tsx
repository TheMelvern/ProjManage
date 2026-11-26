import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import './TeamAvailability.css';

interface Absence {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
}

function dayKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function initials(name: string) {
  return (name.trim() || '?').split(/\s+/).slice(0, 2).map(word => word[0].toUpperCase()).join('');
}

function countConflicts(records: Absence[]) {
  let count = 0;
  for (const [index, first] of records.entries()) {
    for (let other = index + 1; other < records.length; other++) {
      const second = records[other];
      if (first.employeeId !== second.employeeId && first.startDate <= second.endDate && first.endDate >= second.startDate) count++;
    }
  }
  return count;
}

export function TeamAvailability() {
  const [view, setView] = useState(() => new Date());
  const [records, setRecords] = useState<Absence[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const start = dayKey(first);
  const end = dayKey(new Date(year, month + 1, 0));
  const monthly = records?.filter(item => item.startDate <= end && item.endDate >= start) ?? [];
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index + 1 - offset);
    const key = dayKey(date);
    return { date, key, events: monthly.filter(item => item.startDate <= key && item.endDate >= key) };
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const response = await api.get<{ data: Absence[] }>('/leave/team', { signal });
        if (!signal.aborted) setRecords(response.data.data);
      } catch (failure) {
        if (signal.aborted) return;
        const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
        setError((Array.isArray(message) ? message.join(', ') : message) ||
          (failure instanceof Error ? failure.message : 'Unable to load approved absences.'));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  function changeMonth(change: number) {
    setView(current => new Date(current.getFullYear(), current.getMonth() + change, 1));
  }

  return (
    <main className="availability operational-page">
      <header className="head operational-heading"><div><h1>Team Leave Calendar</h1>
        <p>Approved absences across the organization, available to authorized project and people managers.</p></div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="metrics calendar-summary" aria-label="Coverage summary">
        <article><small>Approved leave records</small><strong>{records?.length ?? '\u2014'}</strong></article>
        <article><small>People away this month</small><strong>{records ? new Set(monthly.map(item => item.employeeId)).size : '\u2014'}</strong></article>
        <article><small>Team coverage conflicts</small><strong>{records ? countConflicts(monthly) : '\u2014'}</strong></article>
      </section>
      <section className="card">
        <div className="calendar-head">
          <h2 aria-live="polite">{view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
          <div className="controls">
            <button type="button" onClick={() => changeMonth(-1)} className="pmo-control" aria-label="Previous month">{'\u2039'}</button>
            <button type="button" onClick={() => changeMonth(1)} className="pmo-control" aria-label="Next month">{'\u203a'}</button>
            <button type="button" className="pmo-control" disabled={loading} onClick={() => setRevision(current => current + 1)}>Refresh</button>
          </div>
        </div>
        {loading && <p role="status">{records ? 'Refreshing approved absences\u2026' : 'Loading approved absences\u2026'}</p>}
        {records && <div className="calendar-scroll month-grid" tabIndex={0} role="region" aria-label="Monthly team leave calendar">
          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="day-name">{day}</span>)}
            {cells.map(cell => <div key={cell.key} className={['day', cell.date.getMonth() !== month && 'muted', cell.events.length > 0 && 'hasLeave'].filter(Boolean).join(' ')}>
              <span className="number">{cell.date.getDate()}</span>
              {cell.events.slice(0, 3).map(item => <span key={item.id} className="event" title={item.employeeName + ' \u00b7 ' + item.type}>
                <span className="avatar">{initials(item.employeeName)}</span>{item.employeeName}
              </span>)}
              {cell.events.length > 3 && <small>+{cell.events.length - 3} more</small>}
            </div>)}
          </div>
        </div>}
      </section>
      <section className="card calendar-agenda">
        <div className="calendar-head"><h2><span className="agenda-name">Agenda {'\u00b7'} </span>Absences this month</h2>
          {records && <span>{monthly.length} records</span>}
        </div>
        {records && monthly.length === 0 && !loading && !error && <div className="empty">No approved leave within this month.</div>}
        {monthly.length > 0 && <div className="absence-list">{monthly.map(item => <article key={item.id}>
          <span className="avatar">{initials(item.employeeName)}</span>
          <div><strong>{item.employeeName}</strong><small>{item.type} {'\u00b7'} {item.startDate} to {item.endDate}</small></div>
          <span className="approved">Approved</span>
        </article>)}</div>}
      </section>
    </main>
  );
}
