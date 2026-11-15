# Verification plan and current limitations

## Confirmed source changes
- Existing Vue 3 application preserved.
- Backend provides Prisma schema, local JWT login and organization-scoped project endpoints.
- Vue API base URL uses Vite's `VITE_API_BASE_URL` and project/PMO views have opt-in live API data sources.
- Existing demo authentication is available only when `import.meta.env.DEV && VITE_ENABLE_DEMO_AUTH=true`.
- Framer contains a portfolio dashboard prototype with illustrative data.

## Local commands
Frontend:
```sh
npm ci
npm run build
npm run dev
```

Backend:
```sh
cd backend
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run build
npm run dev
```

Use PostgreSQL locally, with a dedicated database and permissions. Set the backend environment variables per `backend/.env.example`. For frontend API mode copy root `.env.example` to `.env.local` and set `VITE_USE_LIVE_API=true`. Restart Vite after changing environment variables.

## Manual smoke checks
1. `GET /api/health` returns `status: ok`.
2. `POST /api/auth/login` rejects incorrect credentials and returns a bearer token on successful bootstrap login.
3. `GET /api/projects` rejects missing/invalid/expired token.
4. Create a project in the authenticated organization, refresh and verify it is persisted.
5. Refresh `/pmo-dashboard` and `/projects` with API mode enabled; ensure data loads and no demo data is shown.
6. An account from another organization cannot read project details by ID.
7. A non-editor member cannot create or update projects.
8. Logout clears authorization and protected API calls fail.

## Important gaps
This branch has not been installed, built, executed against PostgreSQL, or verified through a browser in the tool environment. The worker has no network access to clone GitHub or install npm packages. GitHub commits and Framer edits were made through their connected tools. CI, DB integration, broad coverage, production-ready security, status-report generation, complete task/RAID APIs, and responsive Framer breakpoints remain follow-on work. Avoid deployment until these are completed.
