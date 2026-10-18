import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const frontendRoot = resolve(projectRoot, "frontend");

const firebaseDefaults: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY:
    "AIzaSyB-oeQCCLGysUG4iuyFpcufMLouAtek4Xs",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "callilog.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "callilog",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "callilog.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "205557324481",
  NEXT_PUBLIC_FIREBASE_APP_ID:
    "1:205557324481:web:c90e650b3493f005535240",
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");

  const firebaseDefines = Object.fromEntries(
    Object.entries(firebaseDefaults).map(([key, fallback]) => [
      `process.env.${key}`,
      JSON.stringify(env[key] || fallback),
    ])
  );

  return {
    root: frontendRoot,
    envDir: projectRoot,
    publicDir: resolve(projectRoot, "public"),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": projectRoot,
      },
    },
    define: {
      ...firebaseDefines,
      __CALLILOG_API_BASE_URL__: JSON.stringify(
        env.VITE_API_BASE_URL || ""
      ),
    },
    build: {
      outDir: resolve(frontendRoot, "dist"),
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      host: "0.0.0.0",
    },
  };
});
