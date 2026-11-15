# Verification and release gates

## Automated GitHub Actions checks

`.github/workflows/verify.yml` validates three independent areas:
- Frontend: `npm ci` and a full Vite production build from `frontend/`.
- Backend: PostgreSQL 16 service, committed Prisma migrations, seed, NestJS build and HTTP API lifecycle checks.
- Dependency audit: `npm audit --omit=dev --audit-level=high` against the tracked frontend lockfile.

Backend smoke coverage includes unauthorized requests, valid JWT login, project/task creation and status updates, risk/issue/decision/action registration, timesheet storage, report generation, membership revocation, cross-tenant denial and read-only member authorization.

## Verified browser smoke and remaining acceptance checks

- Chromium CI verifies API-backed login, project creation, task persistence across refresh, RAID creation, timesheet/report navigation and logout.
- Still required: expired session behavior, Firefox and WebKit compatibility, mobile form input QA.
- Portfolio, project/task editing, RAID and timesheet forms across desktop/tablet/mobile.
- Gantt/timeline import and export for CSV, JSON, Microsoft Project XML and XLSX.
- Keyboard navigation, focus order, labels, contrast and assistive-technology behavior.
- Repeated save/refresh without duplicate records and multi-user concurrency.
- Legacy modules were intentionally removed from the active application; historical code remains accessible in Git history.

## Remaining release blockers

The original localStorage/mock modules and unsupported screens have been removed from the active source tree. The five remaining PMO views are API-backed. Responsive browser coverage outside Chromium, token refresh/revocation, sign-in throttling, production access controls, persistent audit logging, observability, tenant-level QA and deployment infrastructure remain outstanding.

**Release policy:** Successful CI validates the scoped local MVP; it is not certification for public deployment. Merging the tested MVP into `main` is separate from production release. Keep automatic deployment disabled until operational and security controls are completed.
