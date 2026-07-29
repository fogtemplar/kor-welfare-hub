import { eventLog, TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

const AD_GROUP_ID = import.meta.env.VITE_TOSS_BANNER_AD_GROUP_ID?.trim() || "ait.v2.live.04170610c4b54e80";

export default function TossBannerAd() {
  const targetRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!AD_GROUP_ID || !targetRef.current) return;
    try {
      if (!TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) return;
    } catch {
      return;
    }

    let destroySlot: (() => void) | undefined;

    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          if (!targetRef.current) return;
          const slot = TossAds.attachBanner(AD_GROUP_ID, targetRef.current, {
            theme: "light",
            tone: "grey",
            variant: "card",
            callbacks: {
              onAdRendered: () => {
                setVisible(true);
                void eventLog({ log_name: "welfare_banner_rendered", log_type: "event", params: { placement: "onboarding" } }).catch(() => undefined);
              },
              onNoFill: () => {
                setVisible(false);
                void eventLog({ log_name: "welfare_banner_no_fill", log_type: "event", params: { placement: "onboarding" } }).catch(() => undefined);
              },
              onAdFailedToRender: () => {
                setVisible(false);
                void eventLog({ log_name: "welfare_banner_failed", log_type: "event", params: { placement: "onboarding" } }).catch(() => undefined);
              },
            },
          });
          destroySlot = slot.destroy;
        },
        onInitializationFailed: () => setVisible(false),
      },
    });
    return () => destroySlot?.();
  }, []);

  if (!AD_GROUP_ID) return null;
  return (
    <aside className={visible ? "toss-banner visible" : "toss-banner"} aria-label="광고">
      <span>광고</span>
      <div ref={targetRef} />
    </aside>
  );
}
