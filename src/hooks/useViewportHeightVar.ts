"use client";

/**
 * Publish the height of the *visible* viewport as a CSS variable.
 *
 * Why this exists: on iOS Safari the on-screen keyboard does not change `100vh`, and it does not
 * reliably change `100dvh` either. A chat layout sized with either one keeps its composer at the
 * bottom of the layout viewport, which is now behind the keyboard. The page then scrolls, the
 * message list is pushed out of view, and the composer appears to float in a field of black. That
 * is exactly what the owner's iPhone screenshot showed.
 *
 * `window.visualViewport` is the only API that reports the area actually visible while the keyboard
 * is open. This hook writes its height into `--cc-vvh` (px) and keeps it current on resize and on
 * scroll, which also covers the accessory bar and the Dynamic Island safe area.
 *
 * Unknown is not guessed: before the first measurement the variable is simply absent, so callers
 * fall back to `100dvh` and the layout still renders.
 */

import { useEffect } from "react";

export function useViewportHeightVar(varName = "--cc-vvh"): void {
  useEffect(() => {
    const root = document.documentElement;

    const write = () => {
      const vv = window.visualViewport;
      // The visible height, not the layout height. Rounding avoids sub-pixel churn.
      const height = vv ? vv.height : window.innerHeight;
      if (!Number.isFinite(height) || height <= 0) return;
      root.style.setProperty(varName, `${Math.round(height)}px`);
    };

    write();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", write);
    vv?.addEventListener("scroll", write);
    window.addEventListener("resize", write);
    window.addEventListener("orientationchange", write);

    return () => {
      vv?.removeEventListener("resize", write);
      vv?.removeEventListener("scroll", write);
      window.removeEventListener("resize", write);
      window.removeEventListener("orientationchange", write);
      // Leave the variable in place: a remount should not flash the layout to a different height.
    };
  }, [varName]);
}
