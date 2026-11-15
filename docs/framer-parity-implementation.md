# Framer → Vue / NestJS implementation map

Design source: [PMO in Framer](https://framer.com/projects/STom7jCmgSh7YkuQlZOB)

The Framer project uses native editable layers and prototype links, **not a directly exportable Vue 3/NestJS/PostgreSQL codebase**. Implement its component hierarchy and visual language in the existing application rather than deploying the Framer design as the API.

## Implemented in this branch

| Framer workflow | Vue route | NestJS route | Persistence |
| --- | --- | --- | --- |
| Sign In | `/#/login` | `POST /api/auth/login` | User / Membership |
| Sign Up | `/#/signup` | `POST /api/auth/register` | Pending ReviewRequest (password hashed) |
| Portfolio | `/#/portfolio` | Project and report APIs | Projects, Tasks, RAID |
| Projects & Tasks | `/#/workspace` | Project and task APIs | Project, Task |
| Project status / health review | Project workspace / approval queue | `POST /api/reviews/projects` | ReviewRequest, then approved Project |
| RAID | `/#/raid` | Project RAID API | Risk, Issue, Decision, ActionItem |
| Timesheets | `/#/timesheets` | Project timesheet API | TimesheetEntry |
| Reports | `/#/reports` | `GET /api/reports/portfolio` | Derived from project records |
| Leave Tracker | `/#/leave` | `GET /api/leave/mine`, `POST /api/leave` | ReviewRequest |
| Approval Center | `/#/approvals` | `GET /api/reviews`, `POST /api/reviews/:id/decision` | ReviewRequest + AuditEvent |
| Admin Parameters | `/#/admin/parameters` | `GET /api/admin/parameters`, `POST /api/admin/parameters/proposals` | OrganizationParameter once approved |

The shared Vue sidebar contains the new modules. A user avatar badge is displayed in the application header.

## Reviewer policy

- Approval is **server-enforced**, not just a UI label.
- Reviewers must have an appropriate organization membership; only admins may approve registrations and parameter updates.
- A maker may not approve their own request.
- Project status/health writes must use a review; direct project PATCH attempts are rejected.
- A pending review leaves the previously approved project or parameter unchanged.
- Review decisions are persisted with checker ID, status, review time and an AuditEvent.
- Project status/health approvals compare prior values to prevent stale proposals from overwriting newer changes.
- Registration produces no account session until independently approved.

## Local run

First pull the branch or merge the reviewed PR. Configure `backend/.env` from the tracked example and make sure PostgreSQL is running.

```powershell
cd backend
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build
npm start
```

In another PowerShell window:

```powershell
cd frontend
npm ci
npm run dev
```

Set `VITE_USE_LIVE_API=true` and `VITE_API_BASE_URL` to the actual backend origin in `frontend/.env`. Use different ports for frontend and backend. Browser navigation uses Vue Router hash history.

## Still missing before full Framer parity

1. Responsive tablet/mobile versions and all detailed Framer subpages.
2. Full backend maker–checker gates for all task, RAID, timesheet and report mutations. Current enforcement covers project status/health, registration, leave and administrator parameters.
3. Leave balances, entitlement accrual, calendar views, holidays, handover and multi-step leave workflow rules.
4. User invitations, verified-email onboarding, MFA, session revocation and login throttling.
5. Configurable role matrix, independent checker assignment, role-scoped field access and workflow SLAs.
6. Project-level permissions, status reconciliation, notifications and event-driven realtime updates.
7. Full audit detail API, report publication controls, data export governance and accessibility/regression coverage.

Do not claim the Framer prototype itself has backend functionality. Development permissions and local tests are not a production security audit.
