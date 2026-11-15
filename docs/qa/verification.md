# Verification and release gates

## Automated GitHub Actions checks

`.github/workflows/verify.yml` validates three independent areas:
- Frontend: `npm ci` and a full Vite production build from `frontend/`.
- Backend: PostgreSQL 16 service, committed Prisma migrations, seed, NestJS build and HTTP API lifecycle checks.
- Dependency audit: `npm audit --omit=dev --audit-level=high` against the tracked frontend lockfile.

Backend smoke coverage includes unauthorized requests, valid JWT login, project/task creation and status updates, risk/issue/decision/action registration, timesheet storage, report generation, membership revocation, cross-tenant denial and read-only member authorization.

## Browser acceptance checks still required

- Login/logout, expired sessions and navigation in Chromium, Firefox and WebKit.
- Portfolio, project/task editing, RAID and timesheet forms across desktop/tablet/mobile.
- Gantt/timeline import and export for CSV, JSON, Microsoft Project XML and XLSX.
- Keyboard navigation, focus order, labels, contrast and assistive-technology behavior.
- Repeated save/refresh without duplicate records and multi-user concurrency.
- Regression tests of existing legacy modules: claims, leave, invoices, wiki, role administration and Gantt workflows.

## Remaining release blockers

The original application includes several localStorage/mock flows that are not yet backed by the new API. Not all screens are redesigned in Framer or covered by responsive/browser E2E tests. Token refresh/revocation, production access controls, audit logging, operational monitoring, tenant-level QA and infrastructure configuration remain outstanding.

**Policy:** Keep PR #1 as a draft and leave `main` unchanged until the full release checklist passes. Do not treat successful builds and API smoke tests alone as complete production validation.
