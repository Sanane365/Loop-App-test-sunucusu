---
name: Express route ordering in dm.ts
description: POST /dm/:userId catches named sub-paths like /dm/groups before dedicated routes — requires explicit guard.
---

## Rule
In `artifacts/api-server/src/routes/dm.ts`, the route `POST /dm/:userId` is registered before `POST /dm/groups`. Because Express matches routes in registration order, `/dm/groups` was caught by `:userId = "groups"`, the body lacked `content`, and it returned `{ error: "Content required" }`.

**Fix applied:** Added an early guard inside `POST /dm/:userId`:
```js
if ((req.params["userId"] as string) === "groups") {
  res.status(404).json({ error: "Not found" }); return;
}
```

**Why:** Named routes (`/dm/groups`) must come before wildcard routes (`/dm/:userId`) in the router, OR the wildcard handler must explicitly reject known sub-paths.

**How to apply:** Any time a new named `/dm/<name>` route is added to dm.ts, verify it is registered BEFORE `POST /dm/:userId`, or add it to the guard list.
