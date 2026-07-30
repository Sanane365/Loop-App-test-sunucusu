---
name: Loop auth & roles
description: Session cookie auth, role guards, password hash incidents, and Vite proxy setup for Loop app.
---

## Auth mechanism
- Session cookies: `session=<uuid>; HttpOnly; SameSite=Lax; Max-Age=30d`
- `requireAuth` middleware reads cookie → looks up sessions table → attaches `req.user`
- Login supports username OR email (case-insensitive email match via `or(eq(username), eq(email.toLowerCase()))`)

## Roles
- Three roles: `user`, `moderator`, `admin`
- `requireAdmin` / `requireMod` middleware guards in `src/lib/auth.ts`
- mertkaya (id=1) is the seed admin — but role in DB is `user` by default; must be manually set to `admin` via SQL or admin panel

## Admin panel password reset
- `POST /api/admin/users/:id/reset-password` with `{ newPassword }` — admin only
- Frontend: Admin.tsx has 🔑 button per user row that opens a reset dialog

## Password hash incident
- bcryptjs upgraded from 2.x → 3.x; existing hashes ($2b$10$) became unverifiable
- **Fix applied:** reset all pre-existing real user passwords (IDs 6–11) to `Loop2024!` via psql in July 2026
- New registrations work normally; use the admin reset-password endpoint for future incidents

**Why:** bcryptjs v3 changed internal compare behavior, breaking hashes created by v2.

## Vite proxy (critical)
- Without a Vite proxy, `/api/...` requests from the browser go through Replit's external proxy and intermittently fail with "Failed to fetch" (TypeError, network-level)
- **Fix:** `vite.config.ts` has `server.proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } }`
- Always keep this proxy in place; removing it causes intermittent fetch failures in development

**Why:** Replit path-based routing is reliable for production but not guaranteed for dev-server cross-service calls.
