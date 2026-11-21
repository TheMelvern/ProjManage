export const workplaceGroups = [
  {
    title: 'Delivery',
    description: 'Track project health, manage commitments and review delivery risks.',
    icon: 'dashboard',
    items: [
      { to: '/portfolio', label: 'Portfolio Overview', icon: 'dashboard' },
      { to: '/projects', label: 'Projects & Tasks', icon: 'task_alt' },
      { to: '/raid', label: 'RAID Register', icon: 'warning_amber' },
      { to: '/timesheets', label: 'Timesheets', icon: 'schedule' },
      { to: '/reports', label: 'Executive Reports', icon: 'summarize' }
    ]
  },
  {
    title: 'People',
    description: 'Request leave, review your balance and find your leave records.',
    icon: 'groups',
    items: [{ to: '/leave', label: 'Leave Tracker', icon: 'event_available' }]
  },
  {
    title: 'Administration',
    description: 'Manage organization parameters, user access and audit records.',
    icon: 'admin_panel_settings',
    adminOnly: true,
    items: [{ to: '/admin/parameters', label: 'Parameters', icon: 'tune' }]
  }
];

export const workplaceHome = { to: '/workplace', label: 'Workplace', icon: 'home' };

export function allowedWorkplaceGroups(role) {
  return workplaceGroups.filter(group => !group.adminOnly || role === 'ADMIN');
}
