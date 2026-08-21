import { useEffect, useRef, useCallback } from "react";
import { getUnsynced, markSynced, countUnsynced } from "./db";
import { APP_VERSION, ENDPOINT_APPEND_URL, deviceId } from "./config";

type Options = {
  onCount?: (n: number) => void; // update your Unsynced badge
};

export function useSyncQueue({ onCount }: Options = {}) {
  const running = useRef(false);
  const backoffMs = useRef(2000); // start small
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const schedule = useCallback((delay: number) => {
    clearTimer();
    timer.current = window.setTimeout(run, Math.max(0, delay));
  }, []);

  const requestSync = useCallback(() => {
    // fire ASAP
    schedule(0);
  }, [schedule]);

  async function trySendEvent(evt: any) {
    const payload = {
      data: {
        kind: evt.kind,
        timestamp_utc: evt.ts,
        location: evt.location,
        user_name: evt.user_name,
        amount: evt.amount,
        note: evt.note || "",
        device_id: evt.device_id,
        local_event_id: evt.local_event_id,
        app_version: APP_VERSION,
        line_items: evt.line_items || [],
        discount: evt.discount || 0,
        discount_pct: evt.discount_pct || 0,
        payment_type: evt.payment_type,
      },
    };

    const res = await fetch(ENDPOINT_APPEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("api_key")}`,
        "X-Device-ID": deviceId(),
      },
      body: JSON.stringify(payload),
    });

    const out = await res.json().catch(() => ({}));

    if (res.ok && res.status === 200) {
      await markSynced(evt.local_event_id);
    } else {
      throw new Error(out?.error || `HTTP ${res.status}`);
    }
  }

  async function run() {
    if (running.current) return;
    running.current = true;
    try {
      // quick short-circuit if offline
      if (!navigator.onLine) {
        backoffMs.current = Math.min(backoffMs.current * 2, 30000);
        schedule(backoffMs.current);
        return;
      }

      const batch = await getUnsynced(10);
      if (!batch.length) {
        // nothing to do → gentle poll
        backoffMs.current = Math.min(backoffMs.current * 1.5, 15000);
        schedule(backoffMs.current);
        return;
      }

      // process batch
      for (const evt of batch) {
        try {
          await trySendEvent(evt);
        } catch {
          // stop processing this round, back off a bit
          backoffMs.current = Math.min(backoffMs.current * 2, 30000);
          schedule(backoffMs.current);
          onCount && onCount(await countUnsynced());
          return;
        }
      }

      // success path: reset backoff and immediately check if more work remains
      backoffMs.current = 2000;
      onCount && onCount(await countUnsynced());
      schedule(0);
    } finally {
      running.current = false;
    }
  }

  useEffect(() => {
    // expose a manual trigger (debug)
    (window as any).kickSync = () => requestSync();

    // start a gentle poller
    schedule(1500);

    // wake up on network restore or when tab gains focus
    const online = () => requestSync();
    const visible = () =>
      document.visibilityState === "visible" && requestSync();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);

    return () => {
      clearTimer();
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      delete (window as any).kickSync;
    };
  }, [requestSync, schedule]);

  return { requestSync };
}
