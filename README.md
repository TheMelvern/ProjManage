# PMO Portal

A project-management and PMO reporting workspace built on the existing Vue application with a NestJS API and PostgreSQL.

## Monorepo

```text
ProjManage/
├── frontend/     Vue 3 + Vite + Tailwind — existing modules plus new live views
├── backend/      NestJS + Prisma — JWT auth, projects, tasks, RAID, timesheets, reports
├── docs/         Architecture, Framer handoff, test guide
└── .github/      GitHub Actions CI (build, API smoke and dependency audit)
```

## Run locally (Node.js 22+, PostgreSQL)

1. Create a dedicated PostgreSQL database `pmo_portal` and restricted user `pmo_dev`.
2. Copy `backend/.env.example` to `backend/.env` and set a strong JWT secret and unique bootstrap credentials.
3. From `backend/`, execute:
   ```sh
   npm install
   npm run db:generate
   npm run db:deploy
   npm run db:seed
   npm run dev
   ```
4. In a separate terminal, from `frontend/`, execute:
   ```sh
   npm ci
   cp .env.example .env.local
   npm run dev
   ```
   Edit `.env.local` to set `VITE_USE_LIVE_API=true` and `VITE_API_BASE_URL=http://127.0.0.1:3000/api`. Restart Vite if you change environment variables.
5. Open `http://localhost:5173`, sign in with your bootstrap administrator, then use the Portfolio, Delivery Workspace, RAID Register, Timesheets and Executive Reports sections.

See `backend/README.md` for API details and `docs/qa/verification.md` for acceptance criteria.

**Warning:** This is a development MVP, not a production-certified service. Other original Vue screens still use local sample state. Public deployment remains disabled until they are integrated and production security/browser tests are complete.
