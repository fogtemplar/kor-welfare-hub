import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bokji",

  brand: {
    primaryColor: "#3182F6"
  },

  webView: {
    bounces: true,
    pullToRefreshEnabled: true,
    allowsBackForwardNavigationGestures: true
  },

  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    theme: "light",
  },

  permissions: [],
  webBundleDir: "dist"
});
