import { useEffect, useRef, useState } from 'react';
import api from '../../api/axiosConfig';
import { reviewArea, reviewPath } from '../../utils/reviewNavigation';

interface Profile {
  id: string;
  role: string;
}

interface Review {
  id: string;
  makerId: string;
  status: string;
  summary: string;
  kind: string;
  proposed?: { snapshot?: unknown } | null;
}

type ReviewScope = 'CHECK' | 'MINE';

interface Queue {
  title: string;
  items: Review[];
  empty: string;
  scope: ReviewScope;
}

function label(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
}

function canReview(item: Review, current: Profile) {
  return item.status === 'PENDING' && item.makerId !== current.id &&
    ['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(current.role) &&
    (!['admin', 'claims'].includes(reviewArea(item.kind)) || current.role === 'ADMIN') &&
    (item.kind !== 'REPORT_PUBLISH' || (current.role !== 'PROJECT_MANAGER' && Boolean(item.proposed?.snapshot)));
}

export function MyWork({ resolveLink }: { resolveLink: (path: string, scope: ReviewScope) => string }) {
  const [requests, setRequests] = useState<Review[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const activeLoad = useRef<AbortController | null>(null);

  async function load() {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    const { signal } = controller;
    setLoading(true);
    setError('');

    try {
      const [account, reviews] = await Promise.all([
        api.get<{ data: Profile }>('/profile', { signal }),
        api.get<{ data: Review[] }>('/reviews', { signal }),
      ]);
      if (signal.aborted) return;
      setProfile(account.data.data);
      setRequests(reviews.data.data);
    } catch {
      if (!signal.aborted) setError('Could not load your work. Use Refresh to try again.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => activeLoad.current?.abort();
  }, []);

  const queues: Queue[] = [
    {
      title: 'Needs my review',
      items: profile?.id ? requests.filter(item => canReview(item, profile)) : [],
      empty: 'No requests need your review.',
      scope: 'CHECK',
    },
    {
      title: 'My requests',
      items: profile?.id ? requests.filter(item => item.makerId === profile.id) : [],
      empty: 'Your submitted requests will appear here.',
      scope: 'MINE',
    },
  ];

  return (
    <main className="operational-page personal-work">
      <header className="operational-heading">
        <div>
          <h1>My work</h1>
          <p>Track what you submitted and find requests you can review.</p>
        </div>
        <button type="button" className="pmo-control quiet" disabled={loading} onClick={load}>Refresh</button>
      </header>
      {loading && <p role="status">Loading your work…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="personal-queues">
        {queues.map(queue => (
          <section key={queue.scope} className="review-card personal-queue">
            <h2>{queue.title}</h2>
            {!loading && !error && queue.items.length === 0 && <p>{queue.empty}</p>}
            <ul className="personal-list">
              {queue.items.map(item => (
                <li key={item.id}>
                  <a href={resolveLink(reviewPath(item), queue.scope)}>
                    <strong>{item.summary}</strong>
                    <span className="record-state" data-state={item.status}>{label(item.status)}</span>
                  </a>
                  <small>{label(item.kind)}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
