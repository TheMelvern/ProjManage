# PMO Portal API (local development foundation)

NestJS + Prisma + PostgreSQL with authenticated, organization-scoped project APIs. **Not production-ready or independently build-tested.** Bind the service to `127.0.0.1` and do not expose it publicly until hardening and tests are complete.

## Local setup
1. Install Node.js 20+ and PostgreSQL.
2. Create a database `pmo_portal` and restricted local user `pmo_dev`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`, a random `JWT_SECRET` (32+ characters), `BOOTSTRAP_ADMIN_EMAIL`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters). Do not commit `.env`.
4. Run `npm install`.
5. Run `npm run db:generate`.
6. Run `npm run db:migrate -- --name init`.
7. Run `npm run db:seed` to prepare your local organization and administrator.
8. Run `npm run dev` to listen on `http://127.0.0.1:3000`.

## Authenticated endpoints
- `POST /api/auth/login` with `{"email":"...","password":"..."}` returns a one-hour bearer token.
- `GET /api/health` has no credentials requirement.
- `GET /api/projects` requires `Authorization: Bearer <token>`.
- `GET /api/projects/summary` requires a bearer token.
- `GET /api/projects/:id` requires a bearer token.
- `POST /api/projects` and `PATCH /api/projects/:id` require a bearer token.

Organization identity is derived from the validated membership rather than accepted from query parameters. The guard checks live membership for each protected request.

## Not finished
This is an initial API slice, **not** a complete end-to-end product. Add role-specific write permissions, audit records, rate limiting, refresh token rotation, secrets management, frontend login integration, migrations for later data entities, and automated integration/E2E tests before production. Avoid using the Vue application's hardcoded demo credentials in deployed systems.
