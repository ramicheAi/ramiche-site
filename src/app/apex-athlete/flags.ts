import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

const adapter = process.env.FLAGS ? vercelAdapter<boolean, unknown>() : undefined;

/**
 * Gamification feature flag — controls visibility of
 * grit points, tier badges, and team shop across portals.
 */
export const gamificationEnabled = flag<boolean>({
  key: "gamification-enabled",
  adapter,
  defaultValue: false,
  decide() {
    return this.defaultValue as boolean;
  },
  description:
    "Enable gamification features (grit points, tier badges, team shop)",
  options: [
    { value: true, label: "Enabled" },
    { value: false, label: "Disabled" },
  ],
});

/**
 * New athlete onboarding wizard — gradual rollout.
 */
export const newOnboarding = flag<boolean>({
  key: "new-onboarding",
  adapter,
  defaultValue: false,
  decide() {
    return this.defaultValue as boolean;
  },
  description: "Enable redesigned athlete onboarding wizard",
  options: [
    { value: true, label: "Enabled" },
    { value: false, label: "Disabled" },
  ],
});
