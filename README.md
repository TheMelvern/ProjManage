# PMO Portal

PMO workspace developed from the existing Vue codebase, with a NestJS API and PostgreSQL persistence.

## Repository structure

- `frontend/` — Vue 3, Vite, Tailwind, existing PMO modules, and new portfolio, delivery workspace, and reports.
- `backend/` — NestJS, Prisma schema, authentication, projects, tasks, and reporting API.
- `docs/` — technical architecture, Framer design handoff, and verification notes.
- `.github/workflows/verify.yml` — frontend build and PostgreSQL API integration checks.

## Local start

1. Ensure Node.js 22+, npm and PostgreSQL are installed.
2. Copy `backend/.env.example` to `backend/.env`, configure the local database, JWT secret and bootstrap administrator.
3. In a terminal, run `cd backend && npm install && npm run db:generate && npm run db:migrate -- --name init && npm run db:seed && npm run dev`.
4. In another terminal, run `cd frontend && npm ci`.
5. Copy `frontend/.env.example` to `frontend/.env.local`, set `VITE_USE_LIVE_API=true`, and run `npm run dev`.
6. Open `http://localhost:5173` and sign in with the local bootstrap administrator.

See `backend/README.md` and `docs/qa/verification.md` for verification and security limitations.

> This is a development MVP, not a production-certified SaaS. Production deployment is disabled pending security review.
