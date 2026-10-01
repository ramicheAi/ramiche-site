/**
 * Types for Claude Code CLI JSON streaming output
 * Based on research from PROTOCOL.md
 */
export function isAssistantMessage(msg) {
    return msg.type === "assistant";
}
export function isResultMessage(msg) {
    return msg.type === "result";
}
export function isStreamEvent(msg) {
    return msg.type === "stream_event";
}
export function isContentDelta(msg) {
    return (isStreamEvent(msg) &&
        msg.event.type === "content_block_delta" &&
        msg.event.delta?.type === "text_delta");
}
export function isToolUseBlockStart(msg) {
    return (isStreamEvent(msg) &&
        msg.event.type === "content_block_start" &&
        msg.event.content_block?.type === "tool_use");
}
export function isInputJsonDelta(msg) {
    return (isStreamEvent(msg) &&
        msg.event.type === "content_block_delta" &&
        msg.event.delta?.type === "input_json_delta");
}
export function isContentBlockStop(msg) {
    return isStreamEvent(msg) && msg.event.type === "content_block_stop";
}
export function isTextBlockStart(msg) {
    return (isStreamEvent(msg) &&
        msg.event.type === "content_block_start" &&
        msg.event.content_block?.type === "text");
}
export function isSystemInit(msg) {
    return msg.type === "system" && msg.subtype === "init";
}
//# sourceMappingURL=claude-cli.js.map