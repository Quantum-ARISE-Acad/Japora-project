"use client";

import { useEffect, useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * PWA install prompt. Three flavours:
 *
 *   1. Chromium (Android Chrome, Edge, Samsung Internet, desktop Chrome) —
 *      we capture `beforeinstallprompt`, suppress the browser's default mini-
 *      bar, and surface our own card. Clicking Install fires the saved prompt.
 *
 *   2. iOS Safari — no `beforeinstallprompt`. We detect iOS Safari and show a
 *      manual hint ("Tap Share → Add to Home Screen").
 *
 *   3. Already-installed (display-mode: standalone) — we render nothing.
 *
 * Dismissal is sticky for 30 days via localStorage so we don't nag.
 */

const STORAGE_KEY = "japora-install-dismissed-at";
const DISMISS_DAYS = 30;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari standalone flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    const ageMs = Date.now() - at;
    return ageMs < DISMISS_DAYS * 24 * 60 * 60_000;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const { tr } = usePublicLang();
  const [variant, setVariant] = useState<"chromium" | "ios" | null>(null);
  const [savedEvent, setSavedEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setSavedEvent(e as BeforeInstallPromptEvent);
      setVariant("chromium");
    };
    const onInstalled = () => setHidden(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt. Show the hint after a beat
    // so we don't compete with first-paint.
    if (isIosSafari()) {
      const t = setTimeout(() => setVariant("ios"), 2000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage might be unavailable in private mode — no-op.
    }
    setHidden(true);
  }

  async function install() {
    if (!savedEvent) return;
    try {
      await savedEvent.prompt();
      const choice = await savedEvent.userChoice;
      if (choice.outcome === "accepted") {
        setHidden(true);
      } else {
        dismiss();
      }
    } catch {
      // Edge case — just hide.
      dismiss();
    }
  }

  if (!variant || hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:left-auto sm:right-3 sm:w-96 sm:px-0">
      <div className="card flex items-start gap-3 border-brand/20 bg-white p-3 shadow-lg">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand font-black text-white">
          S
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-arctic-900">
            {tr("Ajoutez Japora à votre écran d'accueil", "Add Japora to your home screen")}
          </div>
          {variant === "chromium" ? (
            <p className="mt-0.5 text-xs text-arctic-600">
              {tr("Ouverture plus rapide, fonctionne sans WiFi, sans passer par une boutique d'applications.", "Faster opens, works without WiFi, and no app-store install.")}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-arctic-600">
              {tr("Touchez l'icône", "Tap the")} <span className="font-semibold">{tr("Partager", "Share")}</span> {tr(", puis", "icon, then")}{" "}
              <span className="font-semibold">{tr("Sur l'écran d'accueil", "Add to Home Screen")}</span>.
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {variant === "chromium" && (
              <button onClick={install} className="btn-primary !py-1 text-xs">
                {tr("Installer", "Install")}
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-shape-sm px-2 py-1 text-xs font-medium text-arctic-600 hover:bg-arctic-100"
            >
              {tr("Plus tard", "Not now")}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label={tr("Fermer", "Dismiss")}
          className="grid h-6 w-6 place-items-center rounded text-arctic-400 hover:bg-arctic-100 hover:text-arctic-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
