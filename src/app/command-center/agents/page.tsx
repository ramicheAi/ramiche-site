/* ============================================================================
 * PARALLAX OS — /command-center/agents
 * Renders the collectible AGENTS roster (screen #4) inside the cockpit shell.
 * The roster is driven by the static AGENTS fleet in @/lib/po-data (the design's
 * source of truth for the collectible showpiece). See AgentsRoster.tsx.
 * ========================================================================== */
import AgentsRoster from '@/components/command-center/po/AgentsRoster';

export default function AgentsPage() {
  return <AgentsRoster />;
}
