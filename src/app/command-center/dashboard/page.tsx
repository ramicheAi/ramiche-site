/* ============================================================================
 * /command-center/dashboard — full reskinned Command Center (Parallax OS v4).
 * The 3D holographic stage + ATLAS directive, vitals, fleet, and live feed.
 * Reached via the "expand" grid icon on the Sanctuary landing. The original
 * rich dashboard remains reachable at /command-center/legacy ("classic view").
 * Renders inside .po-shell (provided by layout).
 * ========================================================================== */
import CommandView from '@/components/command-center/po/CommandView';

export default function CommandCenterDashboardPage() {
  return <CommandView />;
}
