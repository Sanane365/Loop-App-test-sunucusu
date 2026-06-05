---
name: Loop app stack
description: Core tech stack and monorepo layout for the Loop social media app.
---

- Frontend: `@workspace/loop-app` (React+Vite, Wouter router, TanStack Query, shadcn/ui)
- Backend: `@workspace/api-server` (Express 5, pino logger)
- DB: `@workspace/db` (Drizzle ORM + PostgreSQL)
- API types: `@workspace/api-client-react` (Orval codegen from OpenAPI), `@workspace/api-zod`
- File uploads: multer → `./uploads/`, served at `/api/uploads/`
- Sessions: cookie `session=<uuid>`, also `Authorization: Bearer <token>`, sessions table in DB
- Demo users: mertkaya/zeynepaydin/selin/alikaya/denizoglu, password `password123`

**Why:** Needed separate packages for clean separation of concerns and to allow codegen from OpenAPI spec.
