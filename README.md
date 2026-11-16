# PMO Portal

Framer-aligned project-management workspace, implementing the [PMO Framer design](https://framer.com/projects/STom7jCmgSh7YkuQlZOB) with **Vue 3 + Vite frontend, NestJS API, Prisma and PostgreSQL**. Unlike Framer's static prototype, app modules read/write persisted records through authenticated API endpoints.

## Modules

| Module | URL (Vue hash routes) | Function |
|---|---|---|
| Sign In / Sign Up | `/#/login`, `/#/signup` | JWT sign-in, independent approval and email verification |
| Portfolio | `/#/portfolio` | Live project health, progress, risks and priorities |
| Projects & Tasks | `/#/projects` | Project creation and updates, tasks, status proposals |
| RAID | `/#/raid` | Risks, issues, decisions, actions |
| Timesheets | `/#/timesheets` | Staff effort proposals and approved time history |
| Executive Reports | `/#/reports` | Live KPIs, independently approved report snapshots and CSV export |
| Leave Tracker | `/#/leave` | Annual/medical/other requests, balances, half-day support, pending cancellation |
| Team Calendar / Records | `/#/leave/team`, `/#/leave/records` | Approved absences, own leave history and export |
| Approval Center | `/#/approvals` | Independently approve/reject/return changes; no self-approval |
| Administration | `/#/admin/parameters`, `/#/admin/users`, `/#/admin/audit` | Reviewed organization parameters, role proposals, audit trails |
| Connected Workflows | `/#/workflows` | Cross-module navigation and data lifecycle |
| Notification Center | `/#/notifications` | User-private pending approval and checker decision notifications |

Project, RAID, timesheet and report detail subpages are under `/#/projects/detail`, `/#/raid/detail`, `/#/timesheets/detail`, `/#/reports/detail`. Modules use responsive navigation and user profile avatar/role badges.

## Local setup (Node 22+, PostgreSQL)

1. Create the PostgreSQL database and restricted login. Choose your own secure DB password.
2. In `backend/`, copy `.env.example` to `.env`; configure `DATABASE_URL`, a unique 32+ character `JWT_SECRET`, and independent `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD` and `BOOTSTRAP_REVIEWER_EMAIL`/`PASSWORD`. The second administrator lets a fresh installation operate maker–checker role and policy changes without self-approval.
3. Open PowerShell in the repo's `backend` folder:

```powershell
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

`npm run build` and `npm run dev` now regenerate Prisma Client from `backend/prisma/schema.prisma` automatically before compiling or starting the API. After pulling schema changes, run `npm run db:deploy` against the configured database before starting the updated service. `npm run db:generate` can also be used explicitly to refresh the generated types.

4. In another terminal:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

5. Open **http://localhost:5174**. API default is `http://127.0.0.1:3000/api`. Set `frontend/.env.local` `VITE_USE_LIVE_API=true` and `VITE_API_BASE_URL=http://127.0.0.1:3000/api`. Frontend route history uses `#/`.

**Important:** To activate account approvals and password recovery, configure transactional email in `backend/.env`. See [email verification and recovery](docs/email-security.md).\n\n**Important:** New source changes use a two-stage process: maker submission → independent checker approval → persisted effect and audit. The maker's proposal is not the approved record. Invite/signup requests likewise cannot authenticate until approval.

## Verification and deployment

GitHub Actions runs the frontend build, frontend production dependency audit, real PostgreSQL migrations and API integration, and Chromium browser E2E (desktop and mobile screenshot artifacts). See [verification](docs/qa/verification.md), [Framer parity map](docs/framer-parity-implementation.md) and [operations and PostgreSQL backup/restore](docs/operations-and-backups.md).

**Scope boundary:** This is a locally verified PMO application, not a certified public SaaS. Before internet-facing production launch, deploy with HTTPS and secret management, configure email ownership verification/MFA, use a distributed rate limiter, audit role/project access in your organization, add public-holiday and accrual policies, full WCAG/Firefox/WebKit coverage, notifications, monitoring/backups, and a production security review. Automatic deployment remains disabled. The intentionally retired legacy mock-only claims/invoice/wiki screens are recoverable via Git history, not active modules.
