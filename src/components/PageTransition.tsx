"use client";

/**
 * PageTransition — simple pass-through wrapper.
 * Previously had a 350ms fade-out/in animation on route changes
 * that caused blank screens and glitchy transitions. Simplified
 * to just render children directly for reliable navigation.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
