"use client";

import { useEffect } from "react";
import { celebrate } from "./confetti";

const KEY = "afterhours-welcomed";

/** One celebratory burst per browser session, timed to land as the hero finishes animating. */
export function WelcomeConfetti() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return; // storage blocked: skip rather than burst on every visit
    }
    const t = window.setTimeout(celebrate, 1600);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
