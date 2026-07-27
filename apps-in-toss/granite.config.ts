import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bokji",
  brand: {
    displayName: "나라가쏜다",
    primaryColor: "#3182F6",
    icon: "https://kor-welfare-hub.vercel.app/app-icon.svg",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev --host 0.0.0.0",
      build: "vite build",
    },
  },
  webViewProps: {
    type: "partner",
    bounces: true,
    pullToRefreshEnabled: true,
    allowsBackForwardNavigationGestures: true,
  },
  navigationBar: {
    withBackButton: false,
    withHomeButton: true,
    withTitle: true,
    theme: "light",
  },
  permissions: [],
  outdir: "dist",
});
