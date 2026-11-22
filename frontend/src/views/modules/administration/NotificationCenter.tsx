import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import './NotificationCenter.css';

interface Notification {
  id: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  readAt?: string | null;
  link?: string | null;
}

interface Inbox {
  items: Notification[];
  unread: number;
}

const allowedLinks = new Set(['/approvals','/projects/approvals','/raid/approvals','/timesheets/approvals','/leave/approvals','/claims/approvals','/reports/approvals','/admin/approvals','/leave','/projects','/reports','/timesheets','/admin/users']);
const requestLink = /^\/(projects|raid|timesheets|leave|reports|admin|claims)\/approvals\/[0-9a-f-]{36}$/i;

function failureMessage(error: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(error) ? error.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (error instanceof Error ? error.message : 'Notification action failed');
}

export function NotificationCenter({ link }: { link: (path: string) => string }) {
  const [inbox, setInbox] = useState<Inbox>({ items: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const load = useRef<AbortController | null>(null);
  const updating = useRef(false);

  async function refresh() {
    load.current?.abort();
    const controller = new AbortController();
    load.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: Inbox }>('/notifications', { signal: controller.signal });
      if (!controller.signal.aborted) setInbox(response.data.data);
    } catch (error) {
      if (!controller.signal.aborted) setError(failureMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    return () => load.current?.abort();
  }, []);

  async function markRead(item?: Notification) {
    if (item?.readAt || updating.current || loading) return;
    updating.current = true;
    setBusy(true);
    try {
      const endpoint = item ? `/notifications/${encodeURIComponent(item.id)}/read` : '/notifications/read-all';
      await api.patch(endpoint);
      const now = new Date().toISOString();
      setInbox(current => ({
        items: current.items.map(entry =>
          entry.readAt || (item && entry.id !== item.id) ? entry : { ...entry, readAt: now }
        ),
        unread: item ? Math.max(0, current.unread - 1) : 0,
      }));
    } catch (error) {
      setError(failureMessage(error));
    } finally {
      updating.current = false;
      setBusy(false);
    }
  }

  const visibleItems = unreadOnly ? inbox.items.filter(item => !item.readAt) : inbox.items;

  return (
    <main className="notification-page operational-page">
      <header className="page-heading operational-heading">
        <div>
          <h1>Notification Center</h1>
          <p>Approval requests, decisions and operational updates addressed to your account.</p>
        </div>
        <button type="button" className="pmo-control quiet" disabled={loading || busy} onClick={refresh}>Refresh</button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="panel">
        <div className="panel-header">
          <h2>Inbox</h2>
          <div className="inbox-actions">
            <div className="work-actions filter-switch" role="group" aria-label="Notification filter">
              <button type="button" className="pmo-control quiet" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button>
              <button type="button" className="pmo-control quiet" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
                Unread{inbox.unread > 0 && <span> {'\u00b7'} {inbox.unread}</span>}
              </button>
            </div>
            {inbox.unread > 0 && <button type="button" className="pmo-control quiet" disabled={busy || loading} onClick={() => markRead()}>Mark all read</button>}
          </div>
        </div>
        {loading ? <p role="status">{'Loading notifications\u2026'}</p>
          : visibleItems.length === 0 ? <p className="empty">{unreadOnly
            ? 'You\u2019re caught up. There are no unread notifications.'
            : 'No notifications yet. Approval updates will appear here.'}</p>
          : (
            <div className="item-list">
              {visibleItems.map(item => {
                const decision = item.kind === 'REVIEW_DECISION';
                const kind = decision ? 'Decision' : item.kind === 'REVIEW_PENDING' ? 'Needs review' : 'Update';
                return (
                  <article key={item.id} className={item.readAt ? 'item' : 'item unread'}>
                    <div className="record-icon">
                      <span className="material-symbols-outlined" aria-hidden="true">{decision ? 'fact_check' : 'notifications_active'}</span>
                    </div>
                    <div className="item-text">
                      <strong>{item.title}</strong><p>{item.body}</p>
                      <small>{kind} {'\u00b7'} {new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                    {!item.readAt && <>
                      <span className="unread-marker" aria-label="Unread" />
                      <button type="button" className="pmo-control quiet" disabled={busy} onClick={() => markRead(item)}>Mark read</button>
                    </>}
                    {item.link && (allowedLinks.has(item.link) || requestLink.test(item.link)) &&
                      <a className="pmo-control quiet" href={link(item.link)} onClick={() => markRead(item)}>Open</a>}
                  </article>
                );
              })}
            </div>
          )}
      </section>
    </main>
  );
}
