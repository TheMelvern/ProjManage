interface WorkplaceLink {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

interface WorkplaceGroup {
  title: string;
  description: string;
  icon: string;
  adminOnly?: boolean;
  items: WorkplaceLink[];
}

export const workplaceGroups: WorkplaceGroup[] = [
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
    items: [{ to: '/leave', label: 'Leave Tracker', icon: 'event_available' },
      { to: '/claims', label: 'Claims', icon: 'receipt_long' },
      { to: '/people/setup', label: 'HR setup', icon: 'badge', adminOnly: true }]
  },
  {
    title: 'Administration',
    description: 'Manage organization parameters, user access and audit records.',
    icon: 'admin_panel_settings',
    adminOnly: true,
    items: [{ to: '/admin/parameters', label: 'Parameters', icon: 'tune' },
      { to: '/admin/approvals', label: 'Admin approvals', icon: 'fact_check' }]
  }
];

export const workplaceHome: WorkplaceLink = { to: '/workplace', label: 'Workplace', icon: 'home' };

export function allowedWorkplaceGroups(role?: string | null) {
  const isAdmin = role === 'ADMIN';
  return workplaceGroups.filter(group => !group.adminOnly || isAdmin).map(group => ({
    ...group,
    items: group.items.filter(item => !item.adminOnly || isAdmin)
  }));
}
