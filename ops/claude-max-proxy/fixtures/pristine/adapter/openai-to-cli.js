/**
 * Converts OpenAI chat request format to Claude CLI input
 */
const MODEL_MAP = {
    // Direct model names (provider prefixes like `claude-code-cli/` and `claude-max/`
    // are stripped by extractModel before consulting this map)
    "claude-opus-4": "claude-opus-4",
    "claude-opus-4-6": "claude-opus-4-6",
    "claude-sonnet-4": "sonnet",
    "claude-sonnet-4-5": "sonnet",
    "claude-sonnet-4-6": "sonnet",
    "claude-haiku-4": "haiku",
    "claude-haiku-4-5": "haiku",
    // 5-family + explicit latest — pass the FULL name to the CLI (which resolves it),
    // so these do NOT fall through to the "opus" default.
    "claude-opus-5": "claude-opus-5",
    "claude-sonnet-5": "claude-sonnet-5",
    "claude-opus-4-8": "claude-opus-4-8",
    "claude-opus-4-7": "claude-opus-4-7",
    // Bare aliases
    "opus": "claude-opus-5",
    "sonnet": "sonnet",
    "haiku": "haiku",
    "opus-max": "claude-opus-5",
    "sonnet-max": "sonnet",
};
/**
 * Extract Claude model alias from request model string
 */
export function extractModel(model) {
    // Try direct lookup
    if (MODEL_MAP[model]) {
        return MODEL_MAP[model];
    }
    // Try stripping provider prefix
    const stripped = model.replace(/^(?:claude-code-cli|claude-max)\//, "");
    if (MODEL_MAP[stripped]) {
        return MODEL_MAP[stripped];
    }
    // Default to opus (Claude Max subscription)
    return "claude-opus-5";
}
/**
 * Extract text from a content field that may be a string or array of content blocks.
 * OpenAI API allows content as either:
 *   - A plain string: "Hello"
 *   - An array of content blocks: [{"type": "text", "text": "Hello"}]
 */
function extractText(content) {
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter((block) => block.type === "text" || block.type === "input_text")
            .map((block) => block.text)
            .join("\n");
    }
    return String(content || "");
}
/**
 * Strip OpenClaw-specific tooling sections from system prompts.
 * These reference tools (exec, process, web_search, etc.) that don't exist
 * in the Claude Code CLI environment, causing the model to get confused.
 * We remove: ## Tooling, ## Tool Call Style, ## OpenClaw CLI Quick Reference,
 * ## OpenClaw Self-Update
 */
function stripOpenClawTooling(text) {
    const sectionsToStrip = [
        "## Tooling",
        "## Tool Call Style",
        "## OpenClaw CLI Quick Reference",
        "## OpenClaw Self-Update",
    ];
    let result = text;
    for (const section of sectionsToStrip) {
        // Match from section header to the next ## header (or end of string)
        const pattern = new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            "\\n[\\s\\S]*?(?=\\n## |$)", "g");
        result = result.replace(pattern, "");
    }
    // Clean up excessive blank lines left behind
    result = result.replace(/\n{3,}/g, "\n\n");
    return result.trim();
}
/**
 * Convert OpenAI messages array to a single prompt string for Claude CLI
 *
 * Claude Code CLI in --print mode expects a single prompt, not a conversation.
 * We format the messages into a readable format that preserves context.
 */
export function messagesToPrompt(messages) {
    const parts = [];
    for (const msg of messages) {
        const text = extractText(msg.content);
        switch (msg.role) {
            case "system":
                // System messages become context instructions
                // Strip OpenClaw tooling sections that conflict with Claude Code's native tools
                parts.push(`<system>\n${stripOpenClawTooling(text)}\n</system>\n`);
                break;
            case "user":
                // User messages are the main prompt
                parts.push(text);
                break;
            case "assistant":
                // Previous assistant responses for context
                parts.push(`<previous_response>\n${text}\n</previous_response>\n`);
                break;
        }
    }
    return parts.join("\n").trim();
}
/**
 * Extract image content blocks from OpenAI messages and convert them to Claude
 * content-block format. Returns [] when there are no images (text-only path).
 * Handles both data: URLs (base64) and http(s) URLs.
 */
function extractImages(messages) {
    const images = [];
    for (const msg of messages) {
        const content = msg.content;
        if (!Array.isArray(content))
            continue;
        for (const block of content) {
            if (!block || (block.type !== "image_url" && block.type !== "input_image"))
                continue;
            const url = typeof block.image_url === "string"
                ? block.image_url
                : block.image_url?.url || block.url;
            if (typeof url !== "string")
                continue;
            const m = url.match(/^data:([^;]+);base64,([\s\S]+)$/);
            if (m) {
                images.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
            }
            else if (/^https?:\/\//.test(url)) {
                images.push({ type: "image", source: { type: "url", url } });
            }
        }
    }
    return images;
}
/**
 * Convert OpenAI chat request to CLI input format.
 *
 * Text-only requests return a plain text prompt (unchanged behaviour).
 * When the request contains image blocks, return a single stream-json user
 * message (text + image content blocks) and flag streamJson=true so the
 * subprocess adds --input-format stream-json — this lets the multimodal `claude`
 * CLI actually see the image (the same vision Claude Code/Atlas has).
 */
export function openaiToCli(request) {
    const images = extractImages(request.messages);
    const textPrompt = messagesToPrompt(request.messages);
    const model = extractModel(request.model);
    if (images.length > 0) {
        const streamMsg = {
            type: "user",
            message: { role: "user", content: [{ type: "text", text: textPrompt }, ...images] },
        };
        return {
            prompt: JSON.stringify(streamMsg) + "\n",
            model,
            sessionId: request.user,
            streamJson: true,
        };
    }
    return {
        prompt: textPrompt,
        model,
        sessionId: request.user, // Use OpenAI's user field for session mapping
    };
}
//# sourceMappingURL=openai-to-cli.js.map