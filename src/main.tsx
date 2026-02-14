import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Don't use confirm() which blocks and can cause issues on mobile PWA
    // Store the update function and apply on next full navigation
    console.log("New version available - will update on next navigation");
    (window as any).__pendingSWUpdate = () => updateSW(true);
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
  onRegistered(registration) {
    console.log("Service worker registered:", registration);
  },
  onRegisterError(error) {
    console.error("Service worker registration error:", error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
