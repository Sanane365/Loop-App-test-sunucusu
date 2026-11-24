import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.loopsocial.app",
  appName: "Loop App",
  webDir: "dist/public",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      initialViewportFitValueHint: "cover",
      insetsHandling: "css",
    },
  },
};

export default config;
