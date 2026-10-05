/**
 * P06 M5: the router's safety rules. Pure and deterministic: text in, a founder-authority finding (or null) out.
 *
 * The invariant: any command that could cause a consequential external action fails toward the FOUNDER, never toward
 * an executing agent. Over-blocking is acceptable (nothing executes in the shadow phase; a founder escalation is
 * cheap); under-blocking is not.
 *
 * Rules run in this order and the first finding wins:
 *   1. SECURITY       credentials, keys, tokens, passwords, access grants: always the founder's.
 *   2. STRONG         unambiguous consequential phrases, anywhere in the command, with or without a named handler:
 *                     git/release ("merge PR 41", "push it to origin main", "land the PR", "promote staging to prod",
 *                     "go live", "cut a release"), external communication ("send the outreach emails", "email the
 *                     leads", "post it to Instagram"), money ("pay the invoice", "refund the customer"), Mission
 *                     lifecycle ("approve M-12", "mark the mission done"), destructive data ("delete the old leads"),
 *                     and approval in any verb form ("approving PR 41", "sign off on it", "lgtm").
 *   3. CLAUSE VERB    a bare authority verb starting any clause ("merge", "deploy it", "fix the bug and deploy").
 *   4. NAMED HANDLER  if the command names a handler or @agent, an authority verb anywhere ("have Claude Code merge").
 * Rules 2 to 4 skip a verb that is directly negated ("don't merge", "never deploy"), used as a noun ("the deploy
 * script"), part of a feature description ("a button to approve", "a script that deploys", "let users publish"),
 * hyphenated ("sign-up"), or (rules 3 and 4 only) aimed at a code object ("release the lock", "merge the
 * arrays", "delete unused imports", "cancel the timer", "publish an internal event").
 */

export type AuthorityCategory =
  | "security" | "git_release" | "external_comms" | "financial" | "mission_lifecycle" | "destructive_data" | "approval" | "authority_verb";

export type AuthorityFinding = { kind: "founder_authority" | "security_decision"; category: AuthorityCategory; rule: string };

const NEGATED = /(?:\bdon'?t|\bdo not|\bnever|\bnot|\bwithout)\s+$/;
const NOUN_USE = /\b(?:the|a|an|this|that|our|my|your|its)\s+$/;
// Describing a feature, not commanding the act: "a button to approve", "a script that deploys", "let users publish".
const FEATURE_DESCRIPTION = /\b(?:button|link|option|endpoint|api|action|ability|way|feature|route|toggle|command|function|method|hook|job|script|tool|form|modal|screen|page|cli|flag)s?\s+(?:that\s+(?:can\s+|will\s+|would\s+)?|which\s+(?:can\s+|will\s+)?|to\s+|for\s+)$|\b(?:let|lets|allow|allows|enable|enables|help|helps)\s+(?:users?|people|the\s+founder|ramon|admins?|coaches|parents|customers|clients|them|someone)\s+(?:to\s+)?$/;
const blocked = (before: string) => NEGATED.test(before) || NOUN_USE.test(before) || FEATURE_DESCRIPTION.test(before);

/* 1. security */
const SECURITY = /\b(grant|revoke|rotate|reset|share|leak|expose|disable)\b[^.!?\n]{0,40}\b(access|permission|permissions|role|roles|admin|authority|key|keys|secret|secrets|token|tokens|credential|credentials|password|passwords|2fa|mfa)\b|\b(api key|secret key|access token|service[_ -]role|credentials?|password|passwords|private key)\b/;

/* 2. strong phrases. Each is [category, rule name, pattern]. */
const W = "[^.;!?\\n]";                       // a character inside the same clause
const STRONG: [AuthorityCategory, string, RegExp][] = [
  // git / release
  ["git_release", "merge", new RegExp(`\\bmerg(?:e|es|ed|ing)\\s+(?:it|this|that|pr\\b|prs\\b|pr\\s*#?\\d+|#\\d+|the\\s+(?:pr|pull request|branch|change|changes|fix|feature)\\b|pull request|${W}{0,40}?\\binto\\s+(?:main|master|prod|production|release)(?![.\\w-]))`)],
  ["git_release", "push_protected", new RegExp(`\\bforce[ -]?push|\\bpush(?:es|ed|ing)?\\s+(?:--force|-f)\\b|\\bpush(?:es|ed|ing)?\\s+(?:it\\s+|this\\s+|that\\s+|everything\\s+|the\\s+\\w+\\s+)?(?:up\\s+)?(?:to\\s+)?(?:origin\\s+|upstream\\s+)?(?:main|master|prod|production)(?![.\\w-])`)],
  ["git_release", "land", /\bland(?:s|ed|ing)?\s+(?:it|this|that|the\s+(?:pr|pull request|branch|change|changes|fix|feature)\b|pr\b|pr\s*#?\d+|#\d+|pull request)/],
  ["git_release", "deploy", /\b(?:re)?deploy(?:s|ed|ing)?(?![-\w])(?:\s+(?:it|this|that|everything)\b|\s+the\s+(?:site|app|cockpit|build|fix|change|changes|release|update|branch|website)\b|\s+(?:it\s+|this\s+)?(?:to\s+)?(?:prod|production|live|staging|vercel)\b)/],
  ["git_release", "ship", /\bship(?:s|ped|ping)?\s+(?:it|this|that|v\d|the\s+(?:release|build|update|feature|fix|change|changes|site|app)\b|to\s+(?:prod|production|users|customers)\b)/],
  ["git_release", "release", /\b(?:cut|tag|publish|draft|create|ship|do)\s+(?:a\s+|the\s+|new\s+|another\s+)*release\b(?!\s+notes|-)|\brelease(?:s|d)?\s+(?:v\d|version\b|it\b|this\b|the\s+(?:build|app|update|version|site|feature|new\s+version)\b|to\s+(?:prod|production|users|customers|the\s+public)\b)/],
  ["git_release", "promote", new RegExp(`\\bpromot(?:e|es|ed|ing)\\s+${W}{0,30}?\\bto\\s+(?:prod|production|live|main)\\b|\\bpromot(?:e|es|ed|ing)\\s+(?:it|this|the\\s+(?:build|release|deploy|deployment|preview))\\b`)],
  ["git_release", "go_live", /\b(?:go(?:es|ing)?|went|gone)\s+live\b|\b(?:take|put|make|push)\s+(?:it|this|that|the\s+\w+)\s+live\b|\blaunch(?:es|ed|ing)?\s+(?:it|this|the\s+(?:site|app|product|campaign|store|drop|feature))\b/],
  ["git_release", "roll_out", /\broll(?:s|ed|ing)?[ -]?out\s+(?:to|it|this|the)\b|\broll(?:\s+it)?\s*back\s+(?:prod|production|the\s+deploy|the\s+release)\b/],
  ["git_release", "github_write", /\b(?:close|reopen)\s+(?:the\s+|this\s+)?(?:pr|pull request|issue)\b|\bclose\s+pr\s*#?\d+/],
  // external communication
  ["external_comms", "send", /\bsend(?:s|ing)?\s+(?:out\s+)?(?:the\s+|an?\s+|our\s+|my\s+|all\s+|those\s+|these\s+)?(?:\w+\s+)?(?:outreach|emails?|e-mails?|texts?|sms|newsletters?|campaigns?|invites?|invitations?|dms?|replies|reply|follow[- ]?ups?|proposals?|invoices?|quotes?|offers?|blasts?)\b/],
  ["external_comms", "contact", /\b(?:email|text|dm|message|call|reply\s+to|respond\s+to|follow\s+up\s+with)\s+(?:the\s+|all\s+|our\s+|my\s+|every\s+|those\s+)?(?:\w+\s+)?(?:leads?|customers?|clients?|prospects?|subscribers?|parents|coaches|swimmers|athletes|dispensaries|investors|partners|list)\b/],
  ["external_comms", "post_social", new RegExp(`\\b(?:post|publish|tweet|share|upload)(?:s|ed|ing)?\\s+${W}{0,30}?\\b(?:to|on)\\s+(?:instagram|ig|tiktok|twitter|x|linkedin|facebook|youtube|threads|reddit|social|the\\s+blog)\\b`)],
  ["external_comms", "publish_content", /\bpublish(?:es|ed|ing)?\s+(?:it\b|(?:the\s+|a\s+|our\s+|this\s+|that\s+|my\s+)?(?:new\s+|latest\s+|weekly\s+)?(?:post|posts|newsletter|article|episode|video|reel|story|blog|podcast|package|site|update|announcement|drop|page|press\s+release)\b)|\bnpm\s+publish\b|\bpublish\s+to\s+npm\b/],
  // money
  ["financial", "pay", /\b(?:pay|refund|reimburse)(?:s|ed|ing)?\b(?!\s+(?:logic|flow|button|page|endpoint|api|handler|code|function|tests?|service|module|component|form|policy|webhook|status|screen|modal|attention))|\bcharge\s+(?:the\s+|a\s+|their\s+|his\s+|her\s+)?(?:card|customer|client|account)\b/],
  ["financial", "purchase", /\b(?:buy|purchase)(?:s|ed|ing)?\s+(?:a|an|the|some|\d|more|another)\b|\b(?:transfer|wire|send)\s+(?:\$|\d|money|funds|the\s+payment)|\bplace\s+(?:a\s+|the\s+)?bets?\b|\bbet\s+(?:\$|\d|on)\b|\b(?:subscribe|upgrade|downgrade)\s+(?:to\s+)?(?:the\s+)?(?:\w+\s+)?(?:plan|tier|subscription)\b|\bcancel\s+(?:the\s+|my\s+|our\s+)?(?:subscription|plan|account|order)\b/],
  // Mission lifecycle (founder-only in M1/M2)
  ["mission_lifecycle", "mission_transition", new RegExp(`\\b(?:approve|verify|cancel|complete|close|reopen|reject)\\s+(?:the\\s+|this\\s+|that\\s+)?(?:mission|plan|synthesis)\\b|\\b(?:approve|verify|cancel|complete|reject)\\s+m-\\d+|\\bmark\\s+${W}{0,30}?\\b(?:complete|completed|done|verified|approved)\\b|\\bm-\\d+\\s+(?:is\\s+)?(?:approved|verified|done|complete)\\b`)],
  // destructive data
  ["destructive_data", "destroy_data", /\b(?:delete|drop|wipe|truncate|purge|erase|nuke)\s+(?:all\s+(?:the\s+|of\s+the\s+)?|the\s+|our\s+|every\s+|old\s+|the\s+old\s+)?(?:production|prod|database|db|table|tables|users|customers|customer\s+data|leads|records|accounts|data|backups?|bucket|storage|history|missions|mailing\s+list)\b/],
  // approval in any verb form
  ["approval", "approve_forms", /\b(?:approv(?:e|es|ed|ing)|green[- ]?light(?:s|ed|ing)?)\b(?!\s+(?:button|flow|logic|page|endpoint|modal|state|status|queue|step|workflow|component|handler|api|tests?|function|screen|ui|view|banner|template|reviewers?|count|badge|column|field|icon|check|checks))|\bsign(?:s|ed|ing)?\s+off(?:\s+on)?\b|^lgtm\b|\blgtm[.! ]*$|\b(?:give|has|have|you\s+have)\s+(?:it\s+)?(?:my\s+)?approval\b|\bmy\s+approval\s+(?:for|to|on)\b/],
];

/* 3/4. generic authority verbs (base form), and the code objects they may act on harmlessly */
const VERB = "(?:approve|reject|merge|deploy|release|publish|cancel|delete|pay|refund|sign(?: off)?|accept|ship|launch|land|promote|roll ?out|(?:force[ -])?push(?: it)? to (?:origin )?(?:main|master|prod|production)|verify(?= (?:m-\\d|(?:the |this )?mission\\b)))";
const OBJECT = "(?=\\s*$|\\s*[.;!?\\n,:]|\\s+(?:and|then|it|this|that|them|these|those|the|a|an|my|our|its|pr\\d*|prs|pull|to|on|into|prod|production|staging|live|v\\d[\\w.]*|now|everything|all|mission|m-\\d+|#?\\d+)\\b)";
const AT_START = new RegExp(`^${VERB}(?![-\\w])${OBJECT}`);
const ANYWHERE = new RegExp(`\\b${VERB}(?![-\\w])`, "g");
const CODE_OBJECT = /^\s+(?:(?:the|a|an|all|any|every|unused|old|stale|dead|duplicate|internal|local|two|both|each|those|these)\s+)*(?:lock|locks|mutex|semaphore|arrays?|lists?|objects?|maps?|dicts?|imports?|timers?|timeouts?|intervals?|listeners?|handlers?|functions?|methods?|resources?|memory|handles?|connections?|sockets?|variables?|vars?|props?|state|cache|caches|buffers?|streams?|promises?|events?|event\s+listeners?|branches?\s+locally|script|scripts|buttons?|flow|logic|pages?|endpoints?|modals?|steps?|workflows?|components?|tests?|configs?|hooks?|queues?|workers?|types?|interfaces?|code|lines?|comments?|todos?|files?|folders?|directories|dependencies|deps|readme|docs?|css|styles?|classes|class|fields?|columns?|rows?|keys\s+in|entries|items|nodes|edges|requests?|jobs?\s+in\s+the\s+queue|commits?\s+locally|stash|logs?|dialog|toast|spinner|subscription\s+(?:in|on)|effect)\b/;
const LEAD = /^(?:(?:claude[ -]?code|claude|codex|chat ?gpt|gpt-?\d[\w.]*|openai|perplexity|open ?claw|@[a-z][a-z0-9_-]*|please|pls|kindly|ok|okay|go ahead(?: and)?|go|now|also|just|then|and|so|can you|could you|you|hey|i|we|let's|lets)\b[\s,:]*)+/;
const CLAUSES = /[.;!?\n,:]|\band\b|\bthen\b/;

function verbAimedAtCode(t: string, verbEnd: number): boolean {
  return CODE_OBJECT.test(t.slice(verbEnd));
}

export function authorityFinding(t: string, handlerNamed: boolean): AuthorityFinding | null {
  if (SECURITY.test(t)) return { kind: "security_decision", category: "security", rule: "security_or_authorization" };

  for (const [category, rule, re] of STRONG) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of t.matchAll(g)) if (!blocked(t.slice(0, m.index ?? 0))) return { kind: "founder_authority", category, rule };
  }

  for (const clause of t.split(CLAUSES)) {
    const c = clause.trim().replace(LEAD, "").trim();
    const m = AT_START.exec(c);
    if (m && !verbAimedAtCode(c, m[0].length)) return { kind: "founder_authority", category: "authority_verb", rule: "clause_verb" };
  }

  if (handlerNamed) {
    for (const m of t.matchAll(ANYWHERE)) {
      const at = m.index ?? 0;
      if (!blocked(t.slice(0, at)) && !verbAimedAtCode(t, at + m[0].length)) {
        return { kind: "founder_authority", category: "authority_verb", rule: "named_handler_verb" };
      }
    }
  }
  return null;
}
