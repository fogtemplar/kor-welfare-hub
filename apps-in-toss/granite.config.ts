import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "kor-welfare-hub",
  brand: {
    displayName: "복지모아",
    primaryColor: "#3182F6",
    icon: "https://kor-welfare-hub.vercel.app/app-icon.svg",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
