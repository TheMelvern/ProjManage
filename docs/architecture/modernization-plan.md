# PMO Portal modernization plan

## Existing baseline
At the start of the modernization, the repository was a Vue 3 + Vite application using Vue Router, Pinia, Tailwind CSS and Axios. Preserve the existing project, Gantt/timeline, timesheet, access-control and PMO views. The initial modernization kept that frontend. The portal subsequently migrated to React and TypeScript.

## Verified integration gaps
- `src/services/projectService.js` returns sample projects and simulates mutations.
- `src/services/dashboardService.js` returns hardcoded statistics.
- `src/views/modules/projects/reports/ReportsView.vue` is a placeholder.
- `src/App.vue` simulates user/role, leave and claim submissions.
- `src/api/axiosConfig.js` reads `VUE_APP_API_BASE_URL` rather than Vite's `VITE_API_BASE_URL`.
- Token keys differ between Axios (`auth_token` / `access_token`) and `authService.js` (`auth-token`).
- Sidebar links to `/analytics` but `src/main.js` does not register that route.
- No backend or database migration directory is present in the reviewed tree.

## Target architecture
- Frontend: React + TypeScript with Vite and React Router; reusable design tokens/components, responsive and WCAG AA.
- Backend: NestJS + TypeScript, REST + OpenAPI, request validation and centralized error handling.
- Persistence: local PostgreSQL with Prisma migrations. No secrets committed.
- Auth: server-side password hashing, short-lived access tokens and rotating refresh tokens, permission guards.
- Tests: unit, API integration, migration checks and Playwright E2E.
- Development: isolated feature branches and pull requests; preserve existing main.

## Phased delivery
1. Audit and stabilize frontend navigation, authentication and API configuration.
2. Define Framer design system and key screens: dashboard, projects, project detail, tasks, RAID, reports, resources, timeline, settings.
3. Implement design tokens and accessible shared UI primitives.
4. Add backend, database schema and migrations.
5. Replace mock services with real APIs; add audit logs, role checks and automated reports.
6. Test, document local setup and open PRs.

## Core relational entities
User, Organization, Membership, Role, Permission, Project, ProjectMember, Milestone, Task, TaskDependency, Risk, Issue, Decision, ActionItem, TimesheetEntry, StatusReport, ReportSnapshot, AuditEvent.

All tenant-owned rows require organization scoping. Project and task updates must check membership and role permissions. Reporting calculations should be reproducible from persisted source records.

## Local PostgreSQL
Use a dedicated development database and role. Store `DATABASE_URL` only in a gitignored environment file. Run migrations before seeding and keep schema evolution versioned.
