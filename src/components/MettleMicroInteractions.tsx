"use client";
import { useEffect } from "react";

/**
 * Auto-enhances all METTLE elements with micro-interactions:
 * - Tap ripple on buttons and clickable cards
 * - Magnetic tilt on cards (follows finger/cursor)
 * - Staggered entrance animations via IntersectionObserver
 * - Number count-up animation for stat values
 */
export default function MettleMicroInteractions() {
  useEffect(() => {
    const root = document.querySelector(".mettle-app");
    if (!root) return;

    const cleanups: (() => void)[] = [];

    // ── 1. TAP RIPPLE — every button and clickable element ──
    function handleRipple(e: Event) {
      const evt = e as PointerEvent;
      const el = evt.currentTarget as HTMLElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;

      const ripple = document.createElement("span");
      ripple.className = "mettle-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      el.style.position = el.style.position || "relative";
      el.style.overflow = "hidden";
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      // Haptic
      if (navigator.vibrate) navigator.vibrate(10);
    }

    const buttons = root.querySelectorAll("button, a[class*='cursor-pointer'], div[class*='cursor-pointer'], [role='button']");
    buttons.forEach((btn) => {
      btn.addEventListener("pointerdown", handleRipple);
      cleanups.push(() => btn.removeEventListener("pointerdown", handleRipple));
    });

    // ── 2. MAGNETIC TILT — bordered cards follow finger/cursor ──
    function handleTiltMove(e: Event) {
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      let clientX: number, clientY: number;

      if (e instanceof TouchEvent) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        const me = e as MouseEvent;
        clientX = me.clientX;
        clientY = me.clientY;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateX = ((clientY - centerY) / rect.height) * -4; // max 4deg
      const rotateY = ((clientX - centerX) / rect.width) * 4;

      el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    }

    function handleTiltEnd(e: Event) {
      const el = e.currentTarget as HTMLElement;
      el.style.transform = "";
    }

    const cards = root.querySelectorAll("div[class*='border'][class*='rounded'], div[class*='border-2'][class*='rounded']");
    cards.forEach((card) => {
      const el = card as HTMLElement;
      // Only cards larger than 100px (skip tiny pills/badges)
      if (el.offsetWidth < 100 || el.offsetHeight < 60) return;

      el.style.transition = "transform 0.15s ease-out";

      el.addEventListener("mousemove", handleTiltMove);
      el.addEventListener("mouseleave", handleTiltEnd);
      el.addEventListener("touchmove", handleTiltMove, { passive: true });
      el.addEventListener("touchend", handleTiltEnd);

      cleanups.push(() => {
        el.removeEventListener("mousemove", handleTiltMove);
        el.removeEventListener("mouseleave", handleTiltEnd);
        el.removeEventListener("touchmove", handleTiltMove);
        el.removeEventListener("touchend", handleTiltEnd);
      });
    });

    // ── 3. STAGGERED ENTRANCE — cards fade in one by one ──
    const entranceObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.add("mettle-entered");
            entranceObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    const entranceCards = root.querySelectorAll("div[class*='border'][class*='rounded'], .game-panel");
    entranceCards.forEach((card, i) => {
      const el = card as HTMLElement;
      if (el.offsetWidth < 80) return; // skip tiny elements
      el.classList.add("mettle-entrance");
      el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; // stagger up to 400ms
      entranceObserver.observe(el);
    });

    cleanups.push(() => entranceObserver.disconnect());

    // ── 4. NUMBER COUNT-UP — stat values animate from 0 ──
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const text = el.textContent?.trim() || "";
          const match = text.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)(%|x|k|K|m|M|s)?$/);
          if (!match) return;

          const target = parseFloat(match[1].replace(/,/g, ""));
          const suffix = match[2] || "";
          const hasCommas = match[1].includes(",");
          const duration = 800;
          const start = performance.now();

          function animate(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;

            let display: string;
            if (Number.isInteger(target)) {
              const rounded = Math.round(current);
              display = hasCommas ? rounded.toLocaleString() : String(rounded);
            } else {
              display = current.toFixed(1);
            }

            el.textContent = display + suffix;

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          }

          el.textContent = "0" + suffix;
          requestAnimationFrame(animate);
          countObserver.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );

    // Target large text that likely contains numbers
    const statEls = root.querySelectorAll("[class*='text-3xl'], [class*='text-4xl'], [class*='text-5xl'], [class*='text-2xl']");
    statEls.forEach((el) => {
      const text = el.textContent?.trim() || "";
      if (/^\d/.test(text)) {
        countObserver.observe(el);
      }
    });

    cleanups.push(() => countObserver.disconnect());

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
