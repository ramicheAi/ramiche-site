"use client";

import { useEffect } from "react";
import { initErrorReporting } from "@/lib/error-reporter";

export default function ErrorReporterInit() {
  useEffect(() => {
    initErrorReporting();
  }, []);
  return null;
}
