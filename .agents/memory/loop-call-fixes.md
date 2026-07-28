---
name: Loop WebRTC call fixes
description: Critical fixes for video flickering and audio issues in WebRTC call overlay
---

## Video flickering fix
Inline ref callbacks `ref={el => { ... }}` in JSX cause React to call old+new function on every re-render,
re-assigning srcObject and interrupting the stream.
**Fix**: Use stable `useCallback` ref callbacks with empty deps (`[]`) — React calls them only once on mount.
```ts
const remoteVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
  remoteVideoRef.current = el;
  if (el && remoteStreamRef.current) { el.srcObject = remoteStreamRef.current; el.play().catch(() => {}); }
}, []);
```

## Audio issues
- `<audio>` element must have `muted={false}` and `volume=1` explicitly set
- Re-attach audio in `attachRemoteStream`: `el.muted = false; el.volume = 1;`

## Minimize button
Moved from top-left (ArrowLeft) to bottom controls row (ChevronDown, labeled "Küçült") — Instagram pattern.

## Video elements architecture
- Do NOT put video elements inside conditional blocks — they get destroyed/recreated on state changes
- Use stable always-in-overlay video elements with stable ref callbacks
- Add a `useEffect` on `[callState, callMinimized]` to re-attach streams when overlay becomes visible

**Why:** Conditional video elements + inline ref callbacks = constant srcObject reassignment = flickering.
