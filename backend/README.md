# PMO Portal Backend

NestJS + Prisma + PostgreSQL API for authenticated, organization-scoped PMO operations.

## Local development

1. Install Node.js 22+ and PostgreSQL.
2. Create a restricted `pmo_dev` role and dedicated `pmo_portal` database.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET` (32+ random characters), `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters).
4. Run:
   ```sh
   npm install
   npm run db:generate
   npm run db:deploy
   npm run db:seed
   npm run build
   npm run dev
   ```
5. API default: `http://127.0.0.1:3000/api`; frontend `http://localhost:5173`.

## API surface

`POST /api/auth/login` accepts email/password and returns a one-hour JWT.

All of these endpoints require `Authorization: Bearer <token>`:

- `GET /api/projects`, `GET /api/projects/summary`, `GET /api/projects/:id`
- `POST /api/projects`, `PATCH /api/projects/:id` (ADMIN, PMO, PROJECT_MANAGER)
- `GET /api/projects/:projectId/tasks`, `POST /api/projects/:projectId/tasks`, `PATCH /api/projects/:projectId/tasks/:id`
- `GET /api/projects/:projectId/raid`
- `POST /api/projects/:projectId/raid/risks`, `POST .../issues`, `POST .../decisions`, `POST .../actions`
- `PATCH /api/projects/:projectId/raid/risks/:id`, `PATCH .../issues/:id`, `PATCH .../actions/:id`
- `GET /api/projects/:projectId/timesheets`, `POST /api/projects/:projectId/timesheets`
- `GET /api/reports/portfolio`, `GET /api/reports/projects/:id`

The unauthenticated `GET /api/health` endpoint exposes status only.

All project and nested-resource lookups verify organization scope. Editors can change delivery records; signed-in members may log their own timesheet entries. Organization membership is rechecked on each request.

## Migration and verification

The initial migration is committed under `prisma/migrations/20261115083000_init`. Use `npm run db:deploy` for an empty development database. Do not run `db push` over shared databases. GitHub Actions runs the migration, creates the test administrator, builds the API and exercises the main endpoints against PostgreSQL 16.

## Before production

Implement secure token rotation and revocation, rate limits on sign-in, detailed audit logging, secrets management, full RBAC and per-project access policy, pagination, upload safeguards, observability, and a comprehensive browser E2E suite. Do not deploy publicly until these controls and remaining legacy frontend modules are verified.
