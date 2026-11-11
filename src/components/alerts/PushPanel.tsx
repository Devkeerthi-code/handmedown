"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/alerts";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "unconfigured";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Asks for notification permission only when the student taps the button, never on page load. */
export function PushPanel({ vapidKey }: { vapidKey: string | null }) {
  const toast = useToast();
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!vapidKey) next = "unconfigured";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/");
        next = (await reg?.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  const enable = () =>
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        });
        const result = await savePushSubscription(sub.toJSON());
        if (!result.ok) throw new Error(result.error);
        setState("on");
        toast("Notifications on", "We'll ping this device when something matches.");
      } catch (e) {
        toast("Couldn't turn on notifications", e instanceof Error ? e.message : undefined, { type: "error" });
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notifications off on this device");
    });

  if (state === "loading") return <div className="push sk" style={{ height: 96 }} aria-hidden="true" />;

  const copy: Record<Exclude<State, "loading">, { title: string; body: string; cls: string }> = {
    on: { title: "Notifications are on for this device", body: "Alerts arrive even when HandMeDown is closed.", cls: "push push--ok" },
    off: { title: "Get a notification when it's listed", body: "Turn on notifications so alerts reach you even when this tab is closed.", cls: "push" },
    denied: { title: "Notifications are blocked", body: "Allow notifications for this site in your browser settings, then reload. Your alerts still show matches below.", cls: "push push--denied" },
    unsupported: { title: "This browser can't show notifications", body: "On iPhone, add HandMeDown to your Home Screen first (Share → Add to Home Screen). Alerts are still saved.", cls: "push" },
    unconfigured: { title: "Push isn't set up on this server yet", body: "Alerts are saved. The admin needs to add VAPID keys to send notifications.", cls: "push" },
  };
  const c = copy[state];

  return (
    <div className={c.cls} role="status">
      <span className="push__ic">
        <Icon name={state === "on" ? "check" : "bell"} />
      </span>
      <div>
        <b>{c.title}</b>
        <p>{c.body}</p>
        {state === "off" || state === "on" ? (
          <div className="push__actions">
            {state === "off" ? (
              <button className="btn btn--primary btn--sm" type="button" onClick={enable} disabled={pending}>
                {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="bell" />}
                Turn on notifications
              </button>
            ) : (
              <button className="btn btn--outline btn--sm" type="button" onClick={disable} disabled={pending}>
                Turn off on this device
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
