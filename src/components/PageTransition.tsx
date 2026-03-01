"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * PageTransition — cinematic dissolve between METTLE routes.
 * Wraps page content and fades out/in on pathname change.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Route changed — fade out, swap content, fade in
      setVisible(false);
      const t = setTimeout(() => {
        setDisplayChildren(children);
        prevPathname.current = pathname;
        // Brief pause before fade-in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
      }, 350); // match fade-out duration
      return () => clearTimeout(t);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(8px) scale(0.995)",
        transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
        willChange: "opacity, transform",
        minHeight: "100vh",
      }}
    >
      {displayChildren}
    </div>
  );
}
