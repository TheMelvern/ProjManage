import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import api from '../api/axiosConfig';
import { reviewPath } from '../utils/reviewNavigation';

interface Destination {
  to: string;
  label: string;
  icon: string;
}
export interface SearchGroup {
  title?: string;
  items: readonly Destination[];
}
interface Project { id: string; name: string }
interface Review { id: string; kind: string; summary: string }
interface Props {
  groups: readonly SearchGroup[];
  link: (path: string) => string;
  navigate: (path: string) => void;
}

function matches(label: string, query: string) {
  const text = label.toLocaleLowerCase();
  return query.split(/\s+/).every(term => {
    let cursor = 0;
    return term.split('*').filter(Boolean).every(part => {
      const index = text.indexOf(part, cursor);
      if (index === -1) return false;
      cursor = index + part.length;
      return true;
    });
  });
}

export function WorkspaceSearch({ groups, link, navigate }: Props) {
  const root = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const requested = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const pendingStep = useRef(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const shortcut = /Mac/.test(navigator.platform) ? '\u2318 K' : 'Ctrl K';
  const value = query.trim().toLocaleLowerCase();

  const pages = [
    ...groups.flatMap(group => group.items.map(item => ({ ...item, key: item.to, category: group.title || 'Page' }))),
    { key: '/notifications', to: '/notifications', label: 'Notification Center', icon: 'notifications', category: 'Workspace' },
  ];
  const resultGroups = [
    { label: 'Pages', items: pages.filter(item => matches(item.label, value)).slice(0, value ? 5 : 9) },
    { label: 'Projects', items: value ? projects.filter(item => matches(item.name, value)).slice(0, 5).map(item => ({
      key: item.id, label: item.name, icon: 'folder', category: 'Project', to: '/projects/' + encodeURIComponent(item.id) + '/workspace',
    })) : [] },
    { label: 'Requests', items: value ? reviews.filter(item => matches(item.summary, value)).slice(0, 5).map(item => ({
      key: item.id, label: item.summary, icon: 'fact_check', category: 'Request', to: reviewPath(item),
    })) : [] },
  ].filter(group => group.items.length);
  const first = resultGroups[0]?.items[0];

  useEffect(() => {
    if (!value || requested.current) return;
    requested.current = true;
    const current = new AbortController();
    controller.current = current;
    const { signal } = current;
    setLoading(true);
    void Promise.allSettled([
      api.get<{ data: Project[] }>('/projects', { signal }),
      api.get<{ data: Review[] }>('/reviews', { signal }),
    ]).then(([projectResults, reviewResults]) => {
      if (signal.aborted) return;
      setProjects(projectResults.status === 'fulfilled' ? projectResults.value.data.data : []);
      setReviews(reviewResults.status === 'fulfilled' ? reviewResults.value.data.data : []);
      setFailed(projectResults.status === 'rejected' || reviewResults.status === 'rejected');
      setLoading(false);
    });
  }, [value]);

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' ||
        document.querySelector('[aria-modal="true"]') || root.current?.closest('[inert]')) return;
      event.preventDefault();
      field.current?.focus();
      setOpen(true);
    }
    document.addEventListener('keydown', focusSearch);
    return () => {
      document.removeEventListener('keydown', focusSearch);
      controller.current?.abort();
    };
  }, []);

  function reset() {
    setQuery('');
    setOpen(false);
  }

  function moveFocus(step: number) {
    const stops = [field.current, ...Array.from(root.current?.querySelectorAll('a[href]') ?? [])];
    const index = stops.findIndex(element => element === document.activeElement);
    (stops[(index + step + stops.length) % stops.length] as HTMLElement | null)?.focus();
  }

  useLayoutEffect(() => {
    if (open && pendingStep.current) {
      moveFocus(pendingStep.current);
      pendingStep.current = 0;
    }
  }, [open]);

  function handleKey(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      field.current?.focus();
      setOpen(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    if (open) moveFocus(step);
    else {
      pendingStep.current = step;
      setOpen(true);
    }
  }

  return (
    <form ref={root} className="workspace-search" role="search" aria-label="Workspace"
      onSubmit={event => {
        event.preventDefault();
        if (!open || !first) return;
        reset();
        navigate(first.to);
      }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={handleKey}>
      <span className="material-symbols-outlined search-icon" aria-hidden="true">search</span>
      <input ref={field} value={query} type="search" aria-label="Search workspace"
        aria-controls={open ? 'workspace-search-results' : undefined} placeholder="Search workspace"
        autoComplete="off" maxLength={120} onFocus={() => setOpen(true)} onChange={event => setQuery(event.target.value)} />
      <kbd aria-hidden="true">{shortcut}</kbd>
      <div hidden={!open} id="workspace-search-results" className="workspace-search-results">
        {!value && <p className="search-note">Find pages, projects and approval requests. Use * to match any text.</p>}
        {resultGroups.map(group => <div key={group.label} className="search-result-group">
          <p className="search-group-label">{group.label}</p>
          <ul>{group.items.map(item => <li key={item.key}>
            <a href={link(item.to)} onClick={reset}>
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span><small>{item.category}</small>
            </a>
          </li>)}</ul>
        </div>)}
        {!first && !loading && value && <p className="search-note" role="status">No matching results.</p>}
        {loading ? <p className="search-note" role="status">Loading projects and requests{'\u2026'}</p>
          : failed && <p className="search-note" role="status">Some records are temporarily unavailable.</p>}
      </div>
    </form>
  );
}
