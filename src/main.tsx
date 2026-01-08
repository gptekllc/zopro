import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // When a new version is available, update immediately
    if (confirm("New version available. Reload to update?")) {
      updateSW(true);
    }
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
