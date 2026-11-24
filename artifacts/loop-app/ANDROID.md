# Android app

The Android app is bundled locally. For a same-Wi-Fi debug build it uses Capacitor's native HTTP transport to reach the HTTPS frontend proxy on the configured LAN IP. The debug build trusts the local development CA only for that IP; release builds use the normal system certificate store. The computer's frontend (port 3000), API (port 8080), and database must remain running; the phone must be on the same Wi-Fi.

From the `artifacts/loop-app` directory in PowerShell:

```powershell
$env:VITE_API_BASE_URL = "https://10.225.73.95:3000"
pnpm run mobile:build
pnpm run mobile:add:android
pnpm run mobile:sync
pnpm run mobile:open
```

Install Java 21 and the Android SDK (including Android SDK Platform 36 or newer) and configure `JAVA_HOME` and `ANDROID_HOME` before opening or building the generated Android project. `mobile:sync` rebuilds the web bundle and copies it into the Android project.

Mobile login sessions are persisted with Android Keystore-backed secure storage and sent to the API as bearer tokens. Use a public HTTPS API origin for production builds.
