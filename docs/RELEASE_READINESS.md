# Adaptive Premium and advanced planning release gate

## Scope

- Premium light/dark theme and user-selected accents are managed in **Profile → Appearance**.
- Projects use one approved task register for stories, subtasks and milestones.
- Dragging a Kanban card **submits** a maker-checker status proposal; it never edits the record immediately.
- Project planning includes a work-item detail panel, parent links, task dependencies, and month/quarter/year timeline scales.

## Pre-release verification

1. Apply all Prisma migrations in a staging clone and verify `npx prisma migrate status` reports no pending migrations.
2. Verify isolated organization permissions: work-item links may only reference tasks from the same project. Both proposal submission and checker approval validate links and reject cycles.
3. Verify maker cannot approve own change and user with MEMBER role cannot propose privileged task changes.
4. Run frontend build, backend integration, browser E2E, and dependency audit; **all four jobs must pass at the final commit**.
5. Inspect the CI browser screenshots in the Actions artifact. Manually check dark/light, all six accent colors, 390 px mobile, keyboard focus, modal open/close, and tooltip legibility.
6. Verify pending proposals remain pending during drag/drop, detail edits, and relationship updates; verify rejected proposals do not mutate tasks.
7. Back up production PostgreSQL before running `npm run db:deploy`; confirm the migration applies without data loss.
8. Verify environment-specific `DATABASE_URL`, mail credentials, session secret, TLS, CORS, reverse proxy, and runtime health checks on the intended deployment environment.
9. Ensure any monitoring and backup restore procedures are tested before a public rollout.

## Local upgrade

```powershell
git checkout main
git pull origin main
cd backend
npm run db:deploy
npm run db:generate
npm run build
npm run dev
```

Run the frontend with `npm run dev` in a separate terminal.

**Note:** Green CI is not evidence of production deployment or a verified production backup. Browser screenshots and runtime review remain a human pre-release gate.
