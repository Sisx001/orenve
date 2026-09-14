# Admin authentication testing

Read /app/memory/test_credentials.md for credentials. Use external REACT_APP_BACKEND_URL for all HTTP calls.
1. Verify admin is seeded idempotently in MongoDB, bcrypt hash starts with $2b$, and unique email index exists.
2. Login sets secure HTTP-only access_token (15 minutes) and refresh_token (7 days) cookies.
3. /api/auth/me works with those cookies and never includes password_hash.
4. Unauthenticated admin endpoints return 401; incorrect-origin mutation requests return 403.
5. Refresh rotates the session, logout revokes it, and old access/refresh tokens are rejected.
6. Five failed login attempts impose a 15-minute lockout, tracked in MongoDB.
7. There is no public registration or customer login.
8. Draft changes never affect public data until publish. Invalid or expired preview tokens must be rejected.
9. The ingress rewrites the public same-origin Origin header to TRUSTED_PROXY_ORIGIN from backend/.env. Both exact origins are explicitly allowlisted; arbitrary origins and missing Origin are denied. Never derive trusted origins from untrusted forwarded headers.