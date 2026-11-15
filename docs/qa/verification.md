# PMO Portal verification and release gates

## GitHub Actions checks

`.github/workflows/verify.yml` is the mandatory merge gate. It performs:
1. **Frontend build**: `npm ci` and Vite production build.
2. **Production frontend dependency audit**: fail on high severity vulnerabilities.
3. **Backend/PostgreSQL integration**: committed Prisma migrations and seed, NestJS build, real HTTP lifecycle in `backend/test/integration.mjs`. Verifies tenant isolation, signup pending/review, maker and independent checker, project and task CRUD through approval, RAID, timesheets, executive published snapshots, leave weekdays/half-day/cancellation, reviewed admin parameters and roles, audit events, session revocation and login lockout.
4. **Browser E2E**: Chromium against a live API and PostgreSQL using `frontend/e2e/smoke.mjs`. Exercises login/signup, project/task/RAID/timesheet/report, leave and admin approvals, logout, and mobile menu. CI collects desktop/mobile screenshots.

## Merge policy

Only merge a feature branch into `main` when all four checks pass for the *exact latest feature branch commit*. Confirm the PR mergeability and head SHA before merging. Do not use stale successful runs from earlier commits.

## Supported scope

Active Framer PMO modules run as a local authenticated application with responsive sidebar and independently reviewed source writes. Existing retired mock-only claim/invoice/wiki screens are intentionally excluded.

## Production readiness requirements (separate release gate)

- Email verification, recovery and MFA for high-privilege identities.
- Distributed/edge rate limiting for multiple API processes; HTTPS, secure secret storage.
- Independent security review of RBAC, object-level scope, token storage, CORS and input validation.
- HR holiday calendars and accrual/pro-rating, additional approval routing and delegation.
- Notifications, escalation SLAs, operational monitoring and protected database backups.
- Complete keyboard/screen-reader WCAG review and Firefox/WebKit browser coverage.
- Deployment staging, incident response, privacy assessment and capacity/load tests.

**Note:** Passing CI proves the targeted local workflows, not regulatory certification or production deployment readiness. Continuous deployment remains disabled.
