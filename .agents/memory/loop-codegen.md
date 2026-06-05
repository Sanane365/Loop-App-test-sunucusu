---
name: Loop codegen
description: API codegen rules for the Loop app.
---

- Run `pnpm --filter @workspace/api-spec run codegen` after any change to `lib/api-spec/openapi.yaml`
- Codegen auto-runs `typecheck:libs` afterward — no separate step needed
- Multipart/file upload endpoints are NOT in the OpenAPI spec to avoid Orval/fetch collisions; they're called manually with `fetch()` + FormData
- Generated files live in `lib/api-client-react/src/generated/`
- If Vite can't find generated files after codegen, restart the loop-app workflow

**Why:** Orval can't generate correct multipart hooks; manual fetch is simpler and more reliable.
