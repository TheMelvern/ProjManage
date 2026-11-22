const moduleByKind: Partial<Record<string, string>> = {
  LEAVE_REQUEST: 'leave',
  CLAIM_REQUEST: 'claims',
  REPORT_PUBLISH: 'reports',
  TIMESHEET_CREATE: 'timesheets',
};

export function reviewArea(kind: string) {
  if (/^(PROJECT|TASK)_/.test(kind)) return 'projects';
  if (/^(RISK|ISSUE|DECISION|ACTION)_/.test(kind)) return 'raid';
  return moduleByKind[kind] || 'admin';
}

export function reviewPath(request: { id: string; kind: string }) {
  return '/' + reviewArea(request.kind) + '/approvals/' + encodeURIComponent(request.id);
}
