/**
 * P06 M5: Universal Command shadow records are founder commands that must NEVER execute. They are stored as user
 * rows in the dedicated universal-command channel with metadata.kind = "universal_command_shadow". Any relay that
 * turns user messages into agent work must skip them. Pure; no I/O.
 */
export function isShadowCommand(msg, channelName) {
  const meta = msg && typeof msg.metadata === "object" && msg.metadata ? msg.metadata : {};
  if (meta.kind === "universal_command_shadow" || meta.shadow === true) return true;
  return typeof channelName === "string" && /universal[ -]command/i.test(channelName);
}
