"use client";

import { useEffect } from "react";
import { getSession, getRedirectForRole } from "./auth";

export default function ApexAthleteRedirect() {
  useEffect(() => {
    const session = getSession();
    if (session) {
      window.location.href = getRedirectForRole(session.role);
    } else {
      window.location.href = "/apex-athlete/login";
    }
  }, []);

  return null;
}
