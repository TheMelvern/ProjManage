import { useState } from 'react';

const stages = [
  { title:'Portfolio', heading:'Service portal is at risk', description:'A delayed integration is putting the target date at risk. The portfolio shows why the project needs attention.', records:[['Projects at risk','1 of 3'],['Overdue work item','Validate identity integration'],['RAID entry','External dependency delayed']], next:'Inspect the work item' },
  { title:'Project work', heading:'Validate identity integration', description:'The delivery team proposes a revised due date and records the reason. The current approved date stays in effect while the request is pending.', records:[['Owner','Jordan Tan'],['Current due date','12 May'],['Proposed due date','16 May'],['Approved effort','6 hours']], next:'View the sample request' },
  { title:'Independent review', heading:'A checker reviews the change', description:'A different authorized reviewer compares the proposed date with the project record and records a decision.', records:[['Request','Work item schedule change'],['Maker','Jordan Tan'],['Checker','Alex Lee'],['Decision','Approved']], next:'See the outcome' },
  { title:'Outcome and audit', heading:'The change appears in the project', description:'The approved date is visible to the team, and the audit trail records who made the decision.', records:[['Work item due date','16 May'],['Audit event','Work item update approved'],['People context','Approved half-day leave appears in the team calendar']] }
];

export function DemoJourney({ link }: { link: (path: string) => string }) {
  const [step, setStep] = useState(0);
  const active = stages[step];

  return (
    <main className="operational-page demo-journey">
      <header className="operational-heading">
        <div>
          <h1>Explore a sample workspace</h1>
          <p>Follow a project change from a delivery risk through independent approval. This walkthrough uses fictional records.</p>
        </div>
        <a className="pmo-control quiet" href={link('/workplace')}>Back to Workplace</a>
      </header>
      <nav className="demo-steps" aria-label="Sample workflow">
        {stages.map((stage, index) => (
          <button key={stage.title} type="button" className="pmo-control quiet"
            aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>
            {stage.title}
          </button>
        ))}
      </nav>
      <section className="review-card demo-card" aria-live="polite">
        <p className="record-state">Sample data</p>
        <h2>{active.heading}</h2>
        <p>{active.description}</p>
        <dl className="demo-records">
          {active.records.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
        </dl>
        <div className="work-actions">
          {step > 0 && <button className="pmo-control quiet" type="button" onClick={() => setStep(step - 1)}>Previous</button>}
          {step < stages.length - 1
            ? <button className="pmo-control primary" type="button" onClick={() => setStep(step + 1)}>{active.next}</button>
            : <a className="pmo-control primary" href={link('/projects')}>Open your projects</a>}
        </div>
      </section>
    </main>
  );
}
