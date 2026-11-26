# PMO Portal — NestJS API

Node 22+, NestJS 10, Prisma 5 and PostgreSQL 16+. All protected endpoints require a JWT bearer token and perform organization membership rechecks. Local default `http://127.0.0.1:3000/api`, frontend origin `http://localhost:5174`.

## Setup

Copy `.env.example` to `.env` and configure database, secure JWT secret and two independent administrator identities. Run:

```powershell
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build
npm run dev
```

Do not run `prisma db push` against a shared database. The seed is for local bootstrap and test environments; use two distinct administrator credentials to initialize separation of duties.

## REST endpoints

- Public: `GET /health`, `POST /auth/login`, `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/request-password-reset`, `POST /auth/reset-password`.
- Auth: `POST /auth/logout` (revokes all existing tokens via sessionVersion).
- Projects: `GET /projects`, `GET /projects/:id`, `GET /projects/summary`. Legacy direct POST/PATCH routes reject writes; submit `POST /reviews/operations` (`PROJECT_CREATE`) or `POST /reviews/projects` (status, health, name, client, description changes).
- Tasks: `GET /projects/:id/tasks`, write through `/reviews/operations` (`TASK_CREATE`, `TASK_UPDATE`).
- RAID: `GET /projects/:id/raid`, write through `/reviews/operations` (`RISK_CREATE`, `RISK_UPDATE`, `ISSUE_CREATE`, `ISSUE_UPDATE`, `ACTION_CREATE`, `ACTION_UPDATE`, `DECISION_CREATE`).
- Timesheets: `GET /projects/:id/timesheets`, write through `/reviews/operations` (`TIMESHEET_CREATE`).
- Reports: `GET /reports/portfolio`, `GET /reports/projects/:id`, `GET /reports/published`; maker submits `REPORT_PUBLISH` proposal; PMO/admin checker releases a snapshot.
- Leave: `GET /leave/mine`, `GET /leave/balances`, `GET /leave/team` (manager), `POST /leave` (including optional AM/PM half-day), `POST /leave/:id/cancel` (maker, pending only).
- Approvals: `GET /reviews`, `POST /reviews/operations`, `POST /reviews/projects`, `POST /reviews/:id/decision`.
- Admin: `GET /admin/parameters`, `POST /admin/parameters/proposals`, `GET /admin/users`, `POST /admin/users/proposals`, `GET /admin/audit`. Restricted to ADMIN.

## Governance rules

A maker creates a pending ReviewRequest. Appropriate different checker approves/rejects/returns it. Approved effects are applied transactionally with the decision and audit event. Direct legacy source-mutation paths are disabled. Project and RAID updates use previously approved version checks. Membership role changes revoke existing JWTs. Leave revalidates overlap and entitlement when approved. Pending leave may be cancelled by its maker.

Account signup is an approval request: the admin checker activates an unverified account, then the owner must redeem a one-time emailed verification token before sign-in. Password recovery uses a separately purposed one-time token and revokes active JWTs. See `../docs/email-security.md` for mail provider configuration. Review APIs never return the pending password hash. The application supports organization-scoped role checks and user account lockout (5 failed attempts for 15 minutes), with additional process-local IP throttling on public auth routes.

## Development tests and limitations

GitHub Actions uses PostgreSQL and `backend/test/integration.mjs` for cross-tenant isolation, approved project/task/RAID/timesheet/report lifecycles, leave balances, two-reviewer workflows, account enrollment, role controls, audit, token revocation and login lockout. Browser E2E checks the same user journeys and responsive navigation.

Not production certification: verify email ownership, add MFA and password recovery, enforce HTTPS, centralize throttle state in shared storage for multi-instance deployments, implement comprehensive public holiday/leave accrual rules and dedicated HR policies, and perform formal penetration/privacy reviews, observability, backup and deployment hardening before public launch.
