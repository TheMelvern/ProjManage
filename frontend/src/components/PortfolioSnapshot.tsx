import { snapshotColumns, type Snapshot } from '../utils/portfolioSnapshot';
import './PortfolioSnapshot.css';

export function PortfolioSnapshot({ data, title }: { data: Snapshot; title: string }) {
  const projects = data.projects ?? [];

  return (
    <section className="snapshot portfolio-snapshot" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <p>{projects.length} {projects.length === 1 ? 'project' : 'projects'} {'·'} Generated {new Date(data.generatedAt).toLocaleString()}</p>
      </header>
      {projects.length === 0 ? <p>This snapshot contains no projects.</p> : (
        <div className="snapshot-scroll" tabIndex={0} role="region" aria-label={title + ' project table'}>
          <table>
            <thead>
              <tr>{snapshotColumns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id}>
                  {snapshotColumns.map(column => <td key={column.key}>{project[column.key] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
