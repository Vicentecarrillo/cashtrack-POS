import { registerSW } from "virtual:pwa-register";

// optional UI hooks
export const startPWA = () =>
  registerSW({
    immediate: true, // register ASAP
    onOfflineReady() {
      // e.g., toast("Offline ready")
      console.log("[PWA] offline ready");
    },
    onNeedRefresh() {
      // e.g., show “new version” prompt and call updateServiceWorker() on confirm
      console.log("[PWA] new version available");
    },
  });
