# Framer to portal parity and integration

**Design reference:** [PMO workspace in Framer](https://framer.com/projects/STom7jCmgSh7YkuQlZOB). Native editable Framer layers are not directly React and NestJS application code: UI runs in the React frontend, with PostgreSQL-backed NestJS workflows.

## Screen/route parity

| Framer design | App route | Live backend |
|---|---|---|
| Login | `/#/login` | JWT sign-in and account lockout |
| Signup | `/#/signup` | New account pending admin check |
| Portfolio | `/#/portfolio` | Approved project, RAID and task reporting |
| Projects & Tasks | `/#/projects`, `/#/projects/detail` | Project/task create/update approval; versions |
| RAID | `/#/raid`, `/#/raid/detail` | Risk/issue/decision/action maker proposal and checker |
| Timesheets | `/#/timesheets`, `/#/timesheets/detail` | Effort submission, approved history |
| Executive reports | `/#/reports`, `/#/reports/detail` | Executive KPIs and approved snapshot CSV export |
| Leave Tracker | `/#/leave`, `/#/leave/records`, `/#/leave/approvals`, `/#/leave/team` | Entitlement, half-day, cancellation, approved calendar |
| Approval Center | `/#/approvals`, `/#/approvals/detail` | Independent decisions, review state and audit |
| Admin Parameters | `/#/admin`, `/#/admin/parameters`, `/#/admin/workflows` | Approved master settings and policy values |
| Users & Roles | `/#/admin/users`, `/#/admin/access` | Membership directory, maker/second-admin checker |
| Audit & Security | `/#/admin/audit` | Audit event viewer |
| Connected Workflows | `/#/workflows` | Cross-module navigation and record relationships |

Every app module links to related modules and uses a common responsive sidebar. Initials avatar badges and role labels appear in user records. A `/#/` hash prefix is expected in the portal but not Framer prototype URLs. Frontend is **localhost:5174**, backend 127.0.0.1:3000.

## Shared data rules

- `organizationId` separates tenants; `projectId` joins projects/tasks/RAID/timesheets/reports.
- Membership is rechecked on each authenticated API call and roles constrain maker/checker actions.
- `ReviewRequest` stores maker, checker, kind, target, proposed value, previous version, decision and time.
- Unapproved proposals do **not** modify source records or live reports.
- Approved project/task/RAID/timesheet changes recalculate the dashboard from PostgreSQL on refresh.
- Executive publication uses the captured snapshot at submission; CSV export is only allowed after independent approval.
- Leave requests have approval state, entitled weekdays and half-day handling; only approved leave affects balance and team availability.
- Audit events capture proposal and checker decisions. Role changes revoke old JWTs.

## Local verification

`.github/workflows/verify.yml` runs frontend build, production frontend package audit, database migrations and server integration, plus Chromium E2E on desktop/mobile with screenshots. Run both apps with `VITE_USE_LIVE_API=true` and two independent admin accounts.

## Constraints before internet-facing production

This implementation covers active Framer PMO modules as a **locally tested application MVP**, not a finished public SaaS compliance implementation. Email ownership validation, recovery/MFA, distributed login throttling, holiday calendars and entitlement accrual rules, delegated approval configurations, notifications/escalation timers, detailed project-level permission scoping, Firefox/WebKit and assistive-technology testing, backups/monitoring, and security/privacy reviews remain separate production work. These should not be represented as operational merely because Framer contains a design for them. Auto-deploy is disabled.
