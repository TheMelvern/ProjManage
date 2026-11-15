# Authenticator-based two-factor authentication (TOTP)

This PMO Portal security enhancement adds **optional account-level MFA**, enforced server-side at sign-in. It uses 6-digit TOTP codes with 30-second time steps (RFC 6238), plus eight separately generated single-use recovery codes.

## Server configuration

Set **MFA_ENCRYPTION_KEY** in the untracked `backend/.env`: exactly 64 hexadecimal characters representing a cryptographically random 32-byte key. Generate a key locally without copying it into GitHub:

```powershell
# Requires Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not reuse the JWT secret for encryption. Keep the key in a managed secret store and an encrypted independent recovery copy. **Losing the key means enrolled MFA secrets cannot be decrypted**. Rotating the key requires an explicitly planned migration; do not simply replace it. MFA setup fails closed when the key is absent or malformed. The CI key is fake and test-only.

## Enrollment

1. Sign in and open **Security Settings** at `/#/profile/security` (or select your avatar).
2. Enter your current password to start enrollment. The API generates a new random TOTP secret, encrypts it using AES-256-GCM and stores it in a pending state for at most 10 minutes.
3. Copy the manual setup secret or the `otpauth://` URI into a trusted authenticator app; use its six-digit code to confirm.
4. Once confirmed, the API stores the encrypted authenticator secret, creates eight random recovery codes whose SHA-256 hashes are stored, and revokes previous JWTs.
5. **Save your recovery codes immediately** in a secure password manager. The cleartext recovery codes are returned once and are never retrievable from the server.
6. Sign in again. The API requires password plus a fresh TOTP or unused recovery code, using a single-use five-minute challenge limited to five verification attempts.

A recovery code can be used once for MFA sign-in. The login challenge itself cannot be replayed after a successful login. TOTP steps used for login are replay-protected. Changing MFA state revokes older tokens.

## Disabling MFA

Open Security Settings while authenticated. Enter your current password plus a valid authenticator or unused recovery code. Disabling invalidates active sessions and deletes stored recovery codes/challenges. If the user has lost all recovery methods, a verified administrative identity-recovery procedure must be designed and independently reviewed; **there is no automatic bypass or hidden recovery endpoint**.

## API surface

Authenticated: `GET /api/auth/mfa/status`, `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/confirm`, `POST /api/auth/mfa/disable`.

Password login `POST /api/auth/login` returns either an access token for non-MFA accounts or a limited `requiresMfa` challenge. The public `POST /api/auth/mfa/complete` redeems a valid challenge+TOTP/recovery code and issues a normal JWT only after second-factor verification.

## Testing and scope limits

CI uses a test-only fake AES key. The integration suite checks enrollment, wrong codes, token invalidation, TOTP login, single-use challenges, recovery codes, and disable/re-enable flows. The Chromium suite checks access to security settings.

This is not FIDO2/WebAuthn phishing-resistant MFA. Hardware security keys, organizational mandatory-MFA policies, secure cookie sessions, distributed throttling, tamper monitoring and penetration testing are future production-security requirements. Users should not store their recovery codes in project documents or browser localStorage.
