# PMO Portal API (development foundation)

NestJS / Prisma / PostgreSQL API. This is an **unauthenticated local-development prototype**, not a production server. It intentionally binds to `127.0.0.1`, and mutation endpoints are not exposed until authenticated organization-scoped authorization is implemented. Read-only project endpoints are likewise not suitable for public deployment without authentication.

## Setup
1. Install Node.js 20+ and PostgreSQL.
2. Create an empty database `pmo_portal` and restricted local role `pmo_dev`.
3. Copy `.env.example` to `.env`, update `DATABASE_URL`.
4. `npm install`
5. `npm run db:generate`
6. `npm run db:migrate -- --name init`
7. `npm run dev`

API:
- `GET /api/health`
- `GET /api/projects?organizationId=<uuid>`
- `GET /api/projects/summary?organizationId=<uuid>`
- `GET /api/projects/:id?organizationId=<uuid>`

No seed records are installed by default. API endpoint availability and build have not been independently verified in a running PostgreSQL environment.

## Before production
Implement authentication, role and tenant guards, audit logging, pagination/rate limiting, automated tests, and deployment hardening.
