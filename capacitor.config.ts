import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.callilog.app",
  appName: "Callilog",
  webDir: "frontend/dist",
  ios: {
    contentInset: "automatic",
  },
};

export default config;
