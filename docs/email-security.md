# Email verification and account recovery

The PMO Portal uses independent administrator approval **and** email verification before issuing a login token to newly registered users.

## Configure transactional mail delivery

The NestJS backend supports the Resend `POST /emails` API through standard HTTPS `fetch`, without a new runtime dependency. Before administrator approvals of new registrations can succeed, set the following values in the *untracked* `backend/.env`:

```dotenv
RESEND_API_KEY=replace_with_real_provider_key
MAIL_FROM="PMO Portal <access@your-verified-domain.example>"
MAIL_API_URL=https://api.resend.com/emails
FRONTEND_ORIGIN=http://localhost:5174
```

Resend requires a sender domain authorized in its console. The app does **not** create a Resend account, register DNS records, or deliver real mail until you configure this provider. A mock HTTP mail endpoint is used only for GitHub Actions with `NODE_ENV=test`.

Do not commit the provider key to GitHub. Production requires HTTPS for the frontend origin and HTTPS for the delivery API.

## Registration lifecycle

1. A prospective user submits Sign Up. The registration remains a pending maker–checker ReviewRequest; no JWT is issued.
2. A different organization administrator approves the request. The API requires working mail configuration before processing approval.
3. The API creates a user with `emailVerifiedAt = null` and sends a random one-time email verification link.
4. Login is rejected until the verification token has been confirmed.
5. The link is SHA-256 hashed in PostgreSQL, expires after **24 hours**, and cannot be reused.
6. If delivery fails after approval, the account remains unverified and the user may request a new email with `/#/resend-verification`.

For schema compatibility, existing accounts present before this migration are treated as trusted and marked verified at migration time. This does not retroactively prove mailbox ownership; organizations that require stronger assurance should run a controlled re-verification rollout.

## Forgotten password

The public `/#/forgot-password` page sends a generic response regardless of whether an email exists. Eligible verified users receive a one-time reset link valid for **30 minutes**. Confirming a reset updates the hashed password, clears failed-login lockouts and increments the user session version, immediately invalidating older JWTs. Expired, wrong-purpose and used tokens are rejected. `/#/reset-password?token=...` is the recipient's landing screen.

Password recovery and resend requests are throttled by source IP in-process. A distributed gateway/Redis rate limiter is still required for multi-instance production.

## Public authentication endpoints

- `POST /api/auth/register` — pending organization approval
- `POST /api/auth/verify-email` — redeem single-use email verification token
- `POST /api/auth/resend-verification` — generic account-safe resend response
- `POST /api/auth/request-password-reset` — generic account-safe reset response
- `POST /api/auth/reset-password` — redeem single-use password reset token and revoke sessions
- `POST /api/auth/login` — email-verified users only
- `POST /api/auth/logout` — authenticated session revocation

## Verification and limitations

The backend CI integration suite starts a private local mock mail endpoint to test administrator-approved signup, account gating, verification, resend token rotation, expiration, replay prevention, reset-password flow and JWT invalidation. The browser suite checks navigation of the new public pages.

This is **not** an MFA implementation. For public production deployment, add multi-factor authentication, distributed throttling, login alerting, full secure-cookie/session threat modeling, and incident recovery, then verify real provider DNS and delivery behavior in staging.
