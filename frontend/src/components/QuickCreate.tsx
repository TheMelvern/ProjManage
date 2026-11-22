import { useRef, useState } from 'react';

interface Props {
  role?: string;
  projectId?: string;
  link: (path: string) => string;
}

export function QuickCreate({ role, projectId, link }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = [
    ...(['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(role ?? '')
      ? [{ path: '/projects/new', icon: 'create_new_folder', label: 'Create project' }] : []),
    { path: '/leave?request=1', icon: 'event_available', label: 'Request leave' },
    { path: '/claims?request=1', icon: 'receipt_long', label: 'Submit expense claim' },
  ];
  if (projectId) {
    const id = encodeURIComponent(projectId);
    options.push(
      { path: `/projects/${id}/workspace?view=backlog&create=1`, icon: 'add_task', label: 'Add work item' },
      { path: `/timesheets?projectId=${id}&create=1`, icon: 'schedule', label: 'Log time' },
    );
  }

  return (
    <div className="quick-create"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}>
      <button ref={trigger} type="button" className="pmo-control create-trigger" aria-label="Create"
        aria-controls="quick-create-options" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
        <span className="create-label">Create</span>
        <span className="material-symbols-outlined create-chevron" aria-hidden="true">expand_more</span>
      </button>
      <div id="quick-create-options" className="quick-create-options" role="group" aria-label="Create options" hidden={!open}>
        {options.map(option => (
          <a key={option.path} href={link(option.path)} onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined" aria-hidden="true">{option.icon}</span>{option.label}
          </a>
        ))}
      </div>
    </div>
  );
}
