---
name: Loop auth & roles
description: Authentication, role system, and ban logic for the Loop app.
---

- Users have `role` field: "user" | "moderator" | "admin"
- `mertkaya` (id=1) is manually set as admin in DB
- Admin routes guarded by `requireAdmin` (admin+moderator) or `requireAdminOnly` (admin only)
- `getUserWithStats()` in helpers.ts now returns `role` and `isBanned` fields
- `sessionMiddleware` updates `lastSeenAt` on every request, checks `isBanned` and returns 403 if banned
- Active users = lastSeenAt within last 5 minutes (GET /chat/active-users)
- Bans table stores userId, ipAddress, reason, bannedBy, expiresAt

**Why:** Role-based access control needed for admin panel; ban system needed for moderation.
**How to apply:** Any new admin route should use `requireAdmin` or `requireAdminOnly` middleware.
