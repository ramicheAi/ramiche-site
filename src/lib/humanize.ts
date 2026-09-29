// /Users/admin/ramiche-site/src/lib/humanize.ts
// De-AI generated outreach copy so it reads like a real person typed it. Asking an
// LLM "no em-dashes / no placeholders" is unreliable — it slips. This enforces it
// deterministically on the output: the single highest-signal tells (em/en dashes,
// bracket merge-placeholders, curly quotes, semicolon-stacking) are stripped every time.

/** Clean one string of the giveaways that mark copy as AI/template-generated. */
export function humanizeCopy(input: string): string {
  if (!input) return input;
  let t = input;

  // 1) Em / en / figure dashes + horizontal bar → a comma. THE #1 AI tell.
  t = t.replace(/ *[—–―‒]+ */g, ", ");

  // 2) Square-bracket merge placeholders: [Name], [your number], [City] → gone.
  t = t.replace(/\[[^\]\n]{0,60}\]/g, "");

  // 3) Parenthetical placeholder after a greeting: "Hi (X team)," → "Hi X team,".
  t = t.replace(/\b(Hi|Hey|Hello|Hello there)\s*\(\s*([^)\n]{1,80}?)\s*\)/gi, "$1 $2");

  // 4) Semicolons (an essay/AI tell in casual copy) → comma.
  t = t.replace(/\s*;\s*/g, ", ");

  // 5) Curly quotes / apostrophes → straight.
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // 6) Clean up artifacts from the replacements.
  t = t
    .replace(/[ \t]+([,.!?:])/g, "$1") // no space before punctuation
    .replace(/,\s*,/g, ",")             // collapse doubled commas
    .replace(/(^|\n)\s*,\s*/g, "$1")    // no line/sentence starting with a comma
    .replace(/[ \t]{2,}/g, " ");        // collapse runs of spaces

  return t.trim();
}

/** Recursively humanize every string in an object/array (e.g. a whole sales kit). */
export function humanizeDeep<T>(value: T): T {
  if (typeof value === "string") return humanizeCopy(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => humanizeDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = humanizeDeep(v);
    return out as unknown as T;
  }
  return value;
}
