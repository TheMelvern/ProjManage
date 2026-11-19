export const snapshotColumns = [
  { key: 'name', label: 'Project' },
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Status' },
  { key: 'health', label: 'Health' },
  { key: 'progressPercent', label: 'Progress (%)' },
  { key: 'completedTasks', label: 'Completed tasks' },
  { key: 'totalTasks', label: 'Total tasks' },
  { key: 'overdueTasks', label: 'Overdue tasks' }
];

function escapeCell(value) {
  const text = String(value ?? '');
  const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function snapshotCSV(snapshot) {
  const rows = [
    snapshotColumns.map(column => column.label),
    ...snapshot.projects.map(project => snapshotColumns.map(column => project[column.key]))
  ];
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}
