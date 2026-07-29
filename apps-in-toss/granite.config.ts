import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bokji",
  brand: {
    displayName: "나라가쏜다",
    primaryColor: "#3182F6",
    icon: "https://static.toss.im/appsintoss/45571/324cf347-98a8-46be-b3b5-c9ee5aec737d.png",
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
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    theme: "light",
  },
  permissions: [],
  outdir: "dist",
});
