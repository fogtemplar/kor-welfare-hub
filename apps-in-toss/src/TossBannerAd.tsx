import { eventLog, TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

const AD_GROUP_ID = import.meta.env.VITE_TOSS_BANNER_AD_GROUP_ID?.trim() || "ait.v2.live.04170610c4b54e80";
let initialized = false;
let initializing = false;
const initializationWaiters = new Set<(ready: boolean) => void>();

function ensureInitialized(callback: (ready: boolean) => void) {
  if (initialized) {
    callback(true);
    return () => undefined;
  }
  initializationWaiters.add(callback);
  if (!initializing) {
    initializing = true;
    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          initialized = true;
          initializing = false;
          initializationWaiters.forEach((waiter) => waiter(true));
          initializationWaiters.clear();
        },
        onInitializationFailed: () => {
          initializing = false;
          initializationWaiters.forEach((waiter) => waiter(false));
          initializationWaiters.clear();
        },
      },
    });
  }
  return () => initializationWaiters.delete(callback);
}

export default function TossBannerAd({ placement = "onboarding" }: { placement?: string }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "visible" | "hidden">("loading");

  useEffect(() => {
    if (!AD_GROUP_ID || !targetRef.current) return;
    try {
      if (!TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) {
        setStatus("hidden");
        return;
      }
    } catch {
      setStatus("hidden");
      return;
    }

    let active = true;
    let destroySlot: (() => void) | undefined;
    const stopWaiting = ensureInitialized((ready) => {
      if (!active || !ready || !targetRef.current) {
        if (active) setStatus("hidden");
        return;
      }
      const slot = TossAds.attachBanner(AD_GROUP_ID, targetRef.current, {
        theme: "light",
        tone: "grey",
        variant: "card",
        callbacks: {
          onAdRendered: () => {
            setStatus("visible");
            void eventLog({ log_name: "welfare_banner_rendered", log_type: "event", params: { placement } }).catch(() => undefined);
          },
          onAdImpression: () => void eventLog({ log_name: "welfare_banner_impression", log_type: "event", params: { placement } }).catch(() => undefined),
          onAdViewable: () => void eventLog({ log_name: "welfare_banner_viewable", log_type: "event", params: { placement } }).catch(() => undefined),
          onAdClicked: () => void eventLog({ log_name: "welfare_banner_clicked", log_type: "event", params: { placement } }).catch(() => undefined),
          onNoFill: () => {
            setStatus("hidden");
            void eventLog({ log_name: "welfare_banner_no_fill", log_type: "event", params: { placement } }).catch(() => undefined);
          },
          onAdFailedToRender: () => {
            setStatus("hidden");
            void eventLog({ log_name: "welfare_banner_failed", log_type: "event", params: { placement } }).catch(() => undefined);
          },
        },
      });
      destroySlot = slot.destroy;
    });
    return () => {
      active = false;
      stopWaiting();
      destroySlot?.();
    };
  }, [placement]);

  if (!AD_GROUP_ID) return null;
  return (
    <aside className={`toss-banner ${status}`} aria-label="광고">
      <span>광고</span>
      <div ref={targetRef} />
    </aside>
  );
}
