import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.73a1414a090b40838962a3f61e301949",
  appName: "zopro",
  webDir: "dist",
  server: {
    url: "https://73a1414a-090b-4083-8962-a3f61e301949.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e40af",
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#1e40af",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
