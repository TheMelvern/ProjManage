# PMO operations and database protection

The application runs PostgreSQL and has organization-scoped data in Projects, Tasks, RAID, Timesheets, Leave Requests, AuditEvent, User, Membership and Notifications. Always verify backup restore before exposing the app to production traffic.

## Windows PostgreSQL backup (PowerShell)

The scripts support the PostgreSQL 18 command-line tools installed locally. Set `DATABASE_URL` securely in your terminal (do not commit it), then:

```powershell
# From repository root; choose a secured location outside the repository
.\scripts\backup-postgres.ps1 -Destination "D:\SecureBackups\pmo-2026-11-15.dump"
```

The backup script uses `pg_dump -Fc` and writes a SHA-256 checksum sidecar. It refuses to overwrite existing backups, and clears `PGPASSWORD` after executing. Verify that both files are present; store copies off the laptop with encryption and limited access. Do not leave unencrypted database backups in your Git repository.

## Guarded restore

**Only run against a database you intend to replace, preferably a disposable test database.**

```powershell
.\scripts\restore-postgres.ps1 -BackupFile "D:\SecureBackups\pmo-2026-11-15.dump" -Force
```

The restore checks the sidecar SHA-256 before executing a destructive `pg_restore --clean --if-exists --exit-on-error`. It does not restore custom role grants; re-verify roles and organization isolation afterward.

## Operational checks

1. Schedule encrypted backups and test restores in a separate database. The scripts do not schedule themselves.
2. Restrict database credentials, enforce TLS for production connections, use a managed secrets store and avoid logging passwords or tokens.
3. Retain application and reverse-proxy logs centrally; redact authentication secrets and personally identifying data.
4. Monitor database disk space, migration failures, login lockouts and request errors.
5. Verify maker-checker separation after restoring, including multiple independent administrators and organization-scoped notifications.
6. Set alerting, recovery targets (RPO/RTO) and backup retention based on your organization's written policy.

## Notification behavior

`GET /api/notifications` lists the 50 latest notifications for the authenticated user and organization. `PATCH /api/notifications/:id/read` and `PATCH /api/notifications/read-all` acknowledge only that user's records. Approver notifications are created when a proposal arrives; makers are notified after a checker decides. No email or external push notifications are implied. Notifications are persistent in PostgreSQL, but the UI refreshes on route navigation, not via realtime WebSockets.

## Leave holidays

Admin Parameters supports `leavePublicHolidays`: a comma-separated set of ISO dates such as `2026-12-25,2027-01-01`. This is a maker-checker-approved organizational setting. The approved dates are excluded from entitled working days during leave submission, balance computation and checker review. Weekends are excluded. Country/state calendars, individual employment-date accrual and prorating are **not** inferred automatically; configure the holiday list with HR oversight.

## Production limitations

The backup scripts are not yet an automated encrypted off-site backup service. In-app notifications are not emails. Production still needs verified email and recovery flows, MFA, distributed rate limiting across API instances, comprehensive per-project authorization, accessibility/browser matrix, monitoring, HTTPS and privacy review before a public launch.
