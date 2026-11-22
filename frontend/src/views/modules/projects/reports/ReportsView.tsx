import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../../api/axiosConfig';
import { PortfolioSnapshot } from '../../../../components/PortfolioSnapshot';
import { PremiumComposeDialog } from '../../../../components/PremiumComposeDialog';
import { SmartSelect } from '../../../../components/SmartSelect';
import { snapshotCSV, type Snapshot } from '../../../../utils/portfolioSnapshot';
import './ReportsView.css';

const liveMode = import.meta.env.VITE_USE_LIVE_API === 'true';
interface Report {
  generatedAt: string;
  summary: { totalProjects: number; activeProjects: number; atRiskProjects: number; overdueTasks: number };
  projects: { id: string; name: string; client?: string; status: string; health: string; progressPercent: number; overdueTasks: number }[];
}
interface Publication { id: string; summary: string; reviewedAt: string; snapshot: Snapshot }

function formatLabel(value: string) {
  return (value || 'Unknown').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function describe(failure: unknown, fallback: string) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) || fallback;
}

function download(snapshot: Snapshot) {
  const objectURL = URL.createObjectURL(new Blob(['\uFEFF' + snapshotCSV(snapshot)], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.download = 'pmo-portfolio-' + snapshot.generatedAt.slice(0, 10) + '.csv';
  anchor.click();
  URL.revokeObjectURL(objectURL);
}

export function ReportsView({ link }: { link: (path: string) => string }) {
  const [loading, setLoading] = useState(liveMode);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [published, setPublished] = useState<Publication[] | null>(null);
  const [publicationId, setPublicationId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; id?: string; error?: boolean } | null>(null);
  const [confirmPublication, setConfirmPublication] = useState(false);
  const [publicationsLoading, setPublicationsLoading] = useState(liveMode);
  const [publicationsError, setPublicationsError] = useState('');
  const [reportRevision, refreshReport] = useState(0);
  const [publicationRevision, refreshPublications] = useState(0);
  const submitting = useRef(false);
  const selected = published?.find(item => item.id === publicationId) ?? published?.[0];
  const metrics = report ? [
    { label: 'Total projects', value: report.summary.totalProjects, note: 'In this organization' },
    { label: 'Active projects', value: report.summary.activeProjects, note: 'Currently underway' },
    { label: 'At risk', value: report.summary.atRiskProjects, note: 'Amber or red health' },
    { label: 'Overdue tasks', value: report.summary.overdueTasks, note: 'Not completed by due date' },
  ] : [];

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError('');
    void api.get<{ data: Report }>('/reports/portfolio', { signal }).then(({ data }) => {
      if (!signal.aborted) setReport(data.data);
    }).catch(failure => {
      if (!signal.aborted) setError(describe(failure, 'Unable to load report. Check API connection and login.'));
    }).finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reportRevision]);

  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    const { signal } = controller;
    setPublicationsLoading(true);
    setPublicationsError('');
    void api.get<{ data: Publication[] }>('/reports/published', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      setPublished(data.data);
      setPublicationId(current => data.data.some(item => item.id === current) ? current : data.data[0]?.id ?? '');
    }).catch(() => {
      if (!signal.aborted) setPublicationsError('Approved snapshots could not be loaded.');
    }).finally(() => { if (!signal.aborted) setPublicationsLoading(false); });
    return () => controller.abort();
  }, [publicationRevision]);

  async function submitPublication() {
    if (!report || submitting.current) return;
    submitting.current = true;
    setConfirmPublication(false);
    setNotice(null);
    setPublishing(true);
    try {
      const { data } = await api.post<{ data: { id: string } }>('/reviews/operations', {
        kind: 'REPORT_PUBLISH', values: {}, summary: 'Executive portfolio snapshot ' + new Date().toISOString().slice(0, 10),
      });
      setNotice({ id: data.data.id, text: 'Publication submitted. A separate PMO checker must approve the snapshot before export.' });
    } catch (failure) {
      setNotice({ text: describe(failure, 'Unable to submit report for review.'), error: true });
    } finally {
      submitting.current = false;
      setPublishing(false);
    }
  }

  function startPublication() {
    if (!report || submitting.current) return;
    if (report.projects.length === 0) setConfirmPublication(true);
    else void submitPublication();
  }

  return (
    <main className="executive-reports operational-page">
      <header className="report-heading operational-heading"><div>
        <h1>Executive status reports</h1>
        <p className="report-description">Portfolio health calculated from saved projects and task completion.</p>
      </div></header>
      {!liveMode ? <p className="report-notice" role="status">Live reporting is not enabled. Set VITE_USE_LIVE_API=true and sign in with your local API account.</p>
        : loading ? <p className="report-notice" role="status">Loading portfolio report…</p>
        : error && <div className="report-notice report-error" role="alert">
          {error}{report && ' Showing the last available portfolio.'}
          <button type="button" onClick={() => refreshReport(current => current + 1)}>Try again</button>
        </div>}
      {notice && <p className="report-notice" role={notice.error ? 'alert' : 'status'}>
        {notice.text}{notice.id && <> <a href={link('/reports/approvals/' + encodeURIComponent(notice.id))}>Open submitted snapshot</a></>}
      </p>}
      <PremiumComposeDialog open={confirmPublication} title="Submit executive snapshot"
        description="The portal captures a new version when you submit. An independent checker reviews that version before it can be downloaded."
        onClose={() => setConfirmPublication(false)}>
        {!report?.projects.length && <p>The live portfolio currently has no projects. The snapshot may contain no records.</p>}
        <button type="button" className="pmo-control primary" disabled={publishing} onClick={submitPublication}>{publishing ? 'Submitting…' : 'Submit snapshot'}</button>
      </PremiumComposeDialog>
      {liveMode && <div className="pmo-action-group live-report-actions">
        <div><h2>Live portfolio</h2>{report && <p>Updated {formatDate(report.generatedAt)}</p>}</div>
        <div className="pmo-action-group">
          <button type="button" className="pmo-control quiet" disabled={loading} onClick={() => refreshReport(current => current + 1)}>Refresh live portfolio</button>
          <button type="button" className="pmo-control primary" disabled={!report || publishing} onClick={startPublication}>Submit snapshot for review</button>
        </div>
      </div>}
      {report && (report.projects.length === 0 ? <section className="work-empty">
        <span className="record-icon material-symbols-outlined" aria-hidden="true">monitoring</span>
        <div><h2>No projects to report yet</h2><p>Approved projects will appear in the live portfolio.</p></div>
        <a className="pmo-control quiet" href={link('/projects')}>View projects and requests</a>
      </section> : <>
        <div className="report-metrics">{metrics.map(metric => <article key={metric.label} className="report-metric">
          <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small>
        </article>)}</div>
        <article className="report-table-card">
          <div className="report-table-heading"><h2>Project portfolio</h2><p>Generated {formatDate(report.generatedAt)}</p></div>
          <div className="report-scroll"><table>
            <thead><tr>{['Project', 'Status', 'Health', 'Progress', 'Overdue tasks'].map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
            <tbody>{report.projects.map(project => <tr key={project.id}>
              <td><a className="queue-record" href={link('/reports/detail?projectId=' + encodeURIComponent(project.id))}>{project.name}</a>
                {project.client && <small>{project.client}</small>}</td>
              <td>{formatLabel(project.status)}</td>
              <td><span className={'health health-' + project.health.toLowerCase()}>{formatLabel(project.health)}</span></td>
              <td>{project.progressPercent}%</td><td>{project.overdueTasks}</td>
            </tr>)}</tbody>
          </table></div>
        </article>
      </>)}
      {liveMode && <section className="report-notice publication-panel" aria-labelledby="approved-heading">
        <div className="pmo-action-group"><h2 id="approved-heading">Approved snapshots</h2>
          <button type="button" className="pmo-control quiet" disabled={publicationsLoading} onClick={() => refreshPublications(current => current + 1)}>Refresh snapshots</button>
        </div>
        {publicationsLoading && <p role="status">Loading approved snapshots…</p>}
        {publicationsError && <p role="alert">{publicationsError}{published?.length ? ' Showing the last available snapshots.' : ''} Use Refresh snapshots to retry.</p>}
        {!publicationsLoading && published?.length === 0 && <p>No approved snapshots yet. A checker must approve a submitted snapshot before export.</p>}
        {selected && <>
          <SmartSelect id="approved-report" modelValue={selected.id} ariaLabel="Approved executive snapshots"
            options={(published ?? []).map(item => ({ value: item.id, label: item.summary + ' · ' + formatDate(item.reviewedAt) }))}
            onChange={value => setPublicationId(String(value))} />
          <div className="work-actions"><span className="record-state" data-state="APPROVED">Approved</span>
            <span>Captured {formatDate(selected.snapshot.generatedAt)} · Approved {formatDate(selected.reviewedAt)}</span>
            <button type="button" className="pmo-control" onClick={() => download(selected.snapshot)}>Download CSV</button>
          </div>
          <PortfolioSnapshot data={selected.snapshot} title="Selected approved snapshot" />
        </>}
      </section>}
    </main>
  );
}
