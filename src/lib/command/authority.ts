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

const NEGATED = /(?:\bdon'?t|\bdo not|\bnever|\bnot|\bwithout|\bshouldn'?t|\bmustn'?t|\bcan'?t|\bwon'?t)\s+(?:to\s+|be\s+|get\s+)?$/;
const NOUN_USE = /\b(?:the|a|an|this|that|our|my|your|its)\s+$/;
// Describing a feature, not commanding the act: "a button to approve", "a script that deploys", "let users publish".
const FEATURE_DESCRIPTION = /\b(?:button|link|option|endpoint|api|action|ability|way|feature|route|toggle|command|function|method|hook|job|script|tool|form|modal|screen|page|cli|flag)s?\s+(?:that\s+(?:can\s+|will\s+|would\s+)?|which\s+(?:can\s+|will\s+)?|to\s+|for\s+)$|\b(?:let|lets|allow|allows|enable|enables|help|helps)\s+(?:users?|people|the\s+founder|ramon|admins?|coaches|parents|customers|clients|them|someone)\s+(?:to\s+)?$/;
/**
 * Code-noun exemptions. They are NARROW by design: an exemption that is too broad becomes a bypass ("drop the prod
 * database SCHEMA", "share the api token HASH with the partner"). Each rule family gets the smallest list that keeps
 * everyday engineering with the agent, and the consequential core never takes an exemption.
 */
// Broad list: only for verb rules on code objects and for the live/prod-switch rule (with an infrastructure guard).
const CODE_NOUNS = String.raw`(?:pages?|components?|filters?|views?|ui|screens?|modals?|tabs?|columns?|buttons?|fields?|forms?|sections?|routes?|tests?|fixtures?|mocks?|stubs?|types?|helpers?|hooks?|code|logic|cards?|panels?|widgets?|menus?|links?|endpoints?|crash|crashes|bugs?|sort|sorting|conflicts?|build|builds|bundler|compiler|flags?|counters?|refresh|layout|styles?|dropdown|selector|picker|reducer|slice|util|utils|component\s+tree)`;
const CODE_AFTER = new RegExp(String.raw`^\s*(?:\w+\s+)?` + CODE_NOUNS + String.raw`\b`);
// UI nouns, directly after the matched words: the only exemption for destructive, messaging and money rules.
const UI_DIRECT = /^\s+(?:pages?|components?|views?|screens?|modals?|buttons?|tabs?|filters?|ui|forms?|cards?|panels?|widgets?|menus?|sections?|columns?|calculations?|logic|layout|copy|dropdown|picker|selector)\b/;
// A named recipient means disclosure, never code: "... with the vendor", "... to the partner".
const RECIPIENT = /\b(?:with|to)\s+(?:the\s+|our\s+|my\s+|a\s+|an\s+)?(?:vendor|vendors|partner|partners|client|clients|customer|customers|contractor|contractors|team|them|him|her|someone|everyone|agency|freelancer|investor|investors|coach|coaches|support|[a-z]+@)\b/;
// Infrastructure words that make a prod/live switch consequential whatever follows.
const INFRA = /\b(?:live|cluster|db|database|domain|dns|traffic|server|servers|region|project|deployment|vercel|cloudflare|supabase|firebase|prod\s+data|stripe|account|accounts|bucket|buckets|storage|endpoint|endpoints|api|keys?|payments?|billing|cdn|queue|webhooks?|env|environment|backend|routes?|flags?|users|traffic|canary|channel|channels|team|teams|off)\b/;
const DESTROY_CORE = /\b(?:prod|production|database|databases|db|tables?|backups?|storage|buckets?|firestore|supabase)\b/;
const DESTROY_EXEMPTIBLE_VERB = /^(?:remove|delete|clear|reset)\b/;
// People, money or data anywhere in the rest of the clause: the act reaches the world, not just the code.
const PEOPLE_DATA = /\b(?:customers?|clients?|users|everyone|everybody|accounts?|subscriptions?|subscribers?|billing|payments?|invoices?|data|records|history|submissions|values|balances|entries|rows|prod|production|database|db|leads|members|coaches|parents|athletes|swimmers|investors|vendors?|partners?)\b/;
// Production or external infrastructure anywhere in the clause: no code exemption of any kind applies.
const CONSEQUENTIAL_CONTEXT = /\b(?:prod|production|db|database|databases|tables?|buckets?|servers?|redis|npm|customers?|firestore|supabase|stripe|vercel|cloudflare|live|webhooks?|cron|repo|repository|plans?|subscriptions?|billing|dns|domain)\b/;
// Verbs that are consequential whatever their object: they never take a code exemption.
const NEVER_CODE_VERB = /^(?:deploy|launch|ship|land|promote|approve|reject|accept|sign|pay|refund|verify|roll ?out|(?:force[ -])?push)/;
// "publish" is code only for an in-process event or a message on an internal bus.
const PUBLISH_CODE_OBJECT = /^\s+(?:an?\s+|the\s+)?(?:internal\s+|local\s+|domain\s+|in-process\s+)?(?:events?|signals?)\b(?![^.;!?\n]*\b(?:to|on)\s+(?:the\s+)?(?:site|web|npm|blog|public|social|instagram|twitter|x|linkedin|users|customers)\b)/;
// "release" is code only for runtime resources.
const RELEASE_CODE_OBJECT = /^\s+(?:(?:the|a|an|all|any|every|unused|old|stale|idle|open)\s+)*(?:lock|locks|mutex|semaphore|resources?|memory|handles?|connections?|sockets?|listeners?|timers?|buffers?|streams?|file\s+handles?|references?|refs?)\b/;
// A credential mentioned while being placed, published or disclosed is never "code".
const CREDENTIAL_DISCLOSURE = /\b(?:put|hardcode|hard-code|commit|upload|dump|paste|push|public|gist|slack|discord|share|email|post|send|log|print|expose|leak|tweet|screenshot|in\s+code|into\s+code|repo|github|bake|frontend|front-end|client|clients|bundle|url|urls|browser|query\s+string)\b/;

const blocked = (before: string) => NEGATED.test(before) || NOUN_USE.test(before) || FEATURE_DESCRIPTION.test(before);
const clauseRest = (t: string, from: number) => t.slice(from).split(/[.;!?\n]/)[0];

/** Whether a strong-rule match may be exempted as code. The consequential core never is. */
function strongExempt(rule: string, t: string, at: number, text: string): boolean {
  const after = t.slice(at + text.length);
  // Only a plain remove/delete/clear/reset of a UI part, with nothing data-like after it, is code. Never purge, wipe,
  // drop, truncate, erase, nuke, kill or destroy, and never a prod / database / table / backup / storage target.
  if (rule === "destroy_broad") return DESTROY_EXEMPTIBLE_VERB.test(text) && !DESTROY_CORE.test(text) && UI_DIRECT.test(after) && !PEOPLE_DATA.test(after.replace(UI_DIRECT, "").split(/[.;!?\n]/)[0]) && !CONSEQUENTIAL_CONTEXT.test(after.split(/[.;!?\n]/)[0]);
  // Messages to people and money are never exempt.
  // Only "switch prod" directly before a build tool is code ("switch prod build to use swc"); never with infrastructure.
  if (rule === "live_switch") return /^switch\s+(?:prod|production)$/.test(text) && /^\s+(?:build|builds|bundler|compiler)\b/.test(after) && !INFRA.test(after.split(/[.;!?\n]/)[0]);
  return false;
}

/** Every match of a pattern, restarting one character after each match start, so a skipped (negated or exempted)
 *  match can never hide a later one inside its span. */
function* matchesFrom(re: RegExp, t: string): Generator<RegExpExecArray> {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(t)) !== null) {
    yield m;
    g.lastIndex = m.index + 1;
  }
}

/* 1. security. verbLed: an act on a credential (never exempt); otherwise a bare mention of a
 *    credential noun, which a code noun may exempt unless a recipient is named. Spans never cross a comma. */
const S = "[^.,;!?\\n]";
const SECURITY_RULES: { re: RegExp; verbLed: boolean }[] = [
  { verbLed: true, re: new RegExp(String.raw`\b(?:grant|revoke|rotate|reset|share|leak|expose|disable|give|send|log|print|post|email|dm|text)\b${S}{0,40}\b(?:access|permission|permissions|role|roles|admin|authority|key|keys|secret|secrets|token|tokens|credential|credentials|password|passwords|2fa|mfa)\b`) },
  { verbLed: false, re: /\b(?:api key|secret key|access token|service[_ -]role|credentials?|password|passwords|private key)\b/ },
  { verbLed: true, re: /\b(?:sk|pk|rk)_(?:live|test)\w*/ },
  { verbLed: true, re: new RegExp(String.raw`\b(?:rotate|revoke|regenerate|reissue|leak|share|expose|paste|send|give|print|log|commit|hardcode|add|set|copy|store|put|post|publish)\b${S}{0,30}\btokens?\b(?!iz)`) },
  { verbLed: false, re: /\b(?:api|access|auth|bearer|github|vercel|stripe|supabase|openai|anthropic|personal\s+access|deploy|service)\s+tokens?\b/ },
  // access and role grants: "make sid an admin", "add them as owner", "make ramon admin", "give the contractor admin access"
  { verbLed: true, re: new RegExp(String.raw`\b(?:make|give|add|grant|set|promote|invite)\b${S}{0,30}\b(?:an?|as|to)\s+(?:\w+\s+)?(?:owner|admin|maintainer|collaborator|member)s?\b(?!\s+(?:list|component|page|view|card|badge|avatar|count|table|row|field|ui|screen|modal))`) },
  { verbLed: true, re: /\bmake\s+(?!(?:the|a|an|it|this|that|sure|admin|owner)\s)\w+\s+(?:an?\s+|the\s+)?(?:owner|admin|maintainer)\b/ },
  { verbLed: true, re: /\bgive\s+(?!(?:the|a|an|it|this|that)\s)\w+\s+(?:owner|admin|maintainer|write|push|merge)\s+(?:rights|access|role|permissions?|privileges)\b|\btransfer\s+(?:the\s+)?ownership\b/ },
  { verbLed: true, re: /\bbranch\s+protection\b|\b(?:turn\s+off|disable|remove)\s+(?:the\s+)?(?:protection|auth|authentication|rls|row\s+level\s+security|firewall|cors)\b/ },
  { verbLed: true, re: new RegExp(String.raw`\b(?:rules?|bucket|storage|database|db|firestore|supabase|repo|repository)\b${S}{0,30}\bpublic\b|\bmake\b${S}{0,30}\bpublic\b`) },
  // secret config edits: each .env mention on its own (".env.example" alone is documentation, not a secret)
  { verbLed: true, re: new RegExp(String.raw`\b(?:add|set|paste|put|change|update|copy)\b[^;!?\n]{0,80}(?:\.env(?!\.(?:example|sample|template|defaults?)\b)\b|\benv\s+vars?\b(?!\s+(?:in|to|into)\s+(?:the\s+)?\.env\.(?:example|sample|template|defaults?)\b(?!\s+(?:and|&|plus)\b))|\benvironment\s+variables?\b(?!\s+(?:in|to|into)\s+(?:the\s+)?\.env\.(?:example|sample|template|defaults?)\b(?!\s+(?:and|&|plus)\b)))`) },
];

/* 2. strong phrases. Each is [category, rule name, pattern]. */
const W = "[^.;!?\\n]";                       // a character inside the same clause
const STRONG: [AuthorityCategory, string, RegExp][] = [
  // git / release
  ["git_release", "merge", new RegExp(`\\bmerg(?:e|es|ed|ing)\\s+(?:it|this|that|pr\\b|prs\\b|pr\\s*#?\\d+|#\\d+|the\\s+(?:pr|pull request|branch|change|changes|fix|feature)\\b|pull request|${W}{0,40}?\\binto\\s+(?:main|master|prod|production|release)(?![.\\w-]))`)],
  ["git_release", "push_protected", new RegExp(`\\bforce[ -]?push|\\bpush(?:es|ed|ing)?\\s+(?:--force|-f)\\b|\\bpush(?:es|ed|ing)?\\s+(?:it\\s+|this\\s+|that\\s+|everything\\s+|(?:the\\s+)?(?:[\\w-]+\\s+){1,4}?)?(?:up\\s+)?(?:to\\s+)?(?:the\\s+)?(?:origin\\s+|upstream\\s+)?(?:main|master|prod|production)(?:\\s+branch)?(?![.\\w-])`)],
  ["git_release", "land", /\bland(?:s|ed|ing)?\s+(?:it|this|that|the\s+(?:pr|pull request|branch|change|changes|fix|feature)\b|pr\b|pr\s*#?\d+|#\d+|pull request)/],
  ["git_release", "deploy", /\b(?:re)?deploy(?:s|ed|ing)?(?![-\w])(?:\s+(?:it|this|that|everything)\b|\s+the\s+(?:site|app|cockpit|build|fix|change|changes|release|update|branch|website)\b|\s+(?:it\s+|this\s+)?(?:to\s+)?(?:prod|production|live|staging|vercel)\b)/],
  ["git_release", "ship", /\bship(?:s|ped|ping)?\s+(?:it|this|that|v\d|the\s+(?:release|build|update|feature|fix|change|changes|site|app)\b|to\s+(?:prod|production|users|customers)\b)/],
  ["git_release", "release", /\b(?:cut|tag|publish|draft|create|ship|do)\s+(?:a\s+|the\s+|new\s+|another\s+)*release\b(?!\s+notes|-)|\brelease(?:s|d)?\s+(?:v\d|version\b|it\b|this\b|the\s+(?:build|app|update|version|site|feature|new\s+version)\b|to\s+(?:prod|production|users|customers|the\s+public)\b)/],
  ["git_release", "promote", new RegExp(`\\bpromot(?:e|es|ed|ing)\\s+${W}{0,30}?\\bto\\s+(?:prod|production|live|main)\\b|\\bpromot(?:e|es|ed|ing)\\s+(?:it|this|the\\s+(?:build|release|deploy|deployment|preview))\\b`)],
  ["git_release", "go_live", /\b(?:go(?:es|ing)?|went|gone)\s+live\b|\b(?:take|put|make|push)\s+(?:it|this|that|the\s+\w+)\s+live(?!-(?:update|updates|updating|reload|reloading|region|search|chat|typing)\b|\w)|\blaunch(?:es|ed|ing)?\s+(?:it|this|the\s+(?:site|app|product|campaign|store|drop|feature))\b/],
  ["git_release", "roll_out", /\broll(?:s|ed|ing)?[ -]?out\s+(?:to|it|this|the)\b|\broll\s+(?:it|this|them|that|everything)\s+out\b|\broll(?:\s+it)?\s*back\s+(?:prod|production|the\s+deploy|the\s+release)\b/],
  ["git_release", "github_write", /\b(?:close|reopen)\s+(?:the\s+|this\s+)?(?:pr|pull request|issue)\b|\bclose\s+pr\s*#?\d+/],
  // external communication
  ["external_comms", "send", /\bsend(?:s|ing)?\s+(?:out\s+)?(?:the\s+|an?\s+|our\s+|my\s+|all\s+|those\s+|these\s+)?(?:\w+\s+)?(?:outreach|emails?|e-mails?|texts?|sms|newsletters?|campaigns?|invites?|invitations?|dms?|replies|reply|follow[- ]?ups?|proposals?|invoices?|quotes?|offers?|blasts?)\b/],
  ["external_comms", "contact", /\b(?:email|text|dm|message|call|reply\s+to|respond\s+to|follow\s+up\s+with)\s+(?:the\s+|all\s+|our\s+|my\s+|every\s+|those\s+)?(?:\w+\s+)?(?:leads?|customers?|clients?|prospects?|subscribers?|parents|coaches|swimmers|athletes|dispensaries|investors|partners)\b|\b(?:email|text|dm|message|call)\s+(?:the|our|my|whole|entire|mailing|email)\s+(?:mailing\s+|email\s+)?list\b/],
  ["external_comms", "post_social", new RegExp(`\\b(?:post|publish|tweet|share|upload)(?:s|ed|ing)?\\s+${W}{0,30}?\\b(?:to|on)\\s+(?:instagram|ig|tiktok|twitter|x|linkedin|facebook|youtube|threads|reddit|social|the\\s+blog)\\b`)],
  ["external_comms", "publish_content", /\bpublish(?:es|ed|ing)?\s+(?:it\b|(?:the\s+|a\s+|our\s+|this\s+|that\s+|my\s+)?(?:new\s+|latest\s+|weekly\s+)?(?:post|posts|newsletter|article|episode|video|reel|story|blog|podcast|package|site|update|announcement|drop|page|press\s+release)\b)|\bnpm\s+publish\b|\bpublish\s+to\s+npm\b/],
  // money
  ["financial", "pay", /\b(?:pay|refund|reimburse)(?:s|ed|ing)?\b(?!\s+(?:logic|flow|button|page|endpoint|api|handler|code|function|tests?|service|module|component|form|policy|webhook|status|screen|modal|attention))|\bcharge\s+(?:the\s+|a\s+|their\s+|his\s+|her\s+)?(?:card|customer|client|account)\b/],
  ["financial", "purchase", /\b(?:buy|purchase)(?:s|ed|ing)?\s+(?:a|an|the|some|\d|more|another)\b|\b(?:transfer|wire|send)\s+(?:\$|\d|money|funds|the\s+payment)|\bplace\s+(?:a\s+|the\s+)?bets?\b|\bbet\s+(?:\$|\d|on)\b|\b(?:subscribe|upgrade|downgrade)\s+(?:to\s+)?(?:the\s+)?(?:\w+\s+)?(?:plan|tier|subscription)\b|\bcancel\s+(?:the\s+|my\s+|our\s+)?(?:subscription|plan|account|order)\b/],
  // Mission lifecycle (founder-only in M1/M2)
  ["mission_lifecycle", "mission_transition", new RegExp(`\\b(?:approve|verify|cancel|complete|close|reopen|reject)\\s+(?:the\\s+|this\\s+|that\\s+)?(?:mission|plan|synthesis)\\b|\\b(?:approve|verify|cancel|complete|reject)\\s+m-\\d+|\\bmark\\s+${W}{0,30}?\\b(?:complete|completed|done|verified|approved)\\b|\\bm-\\d+\\s+(?:is\\s+)?(?:approved|verified|done|complete)\\b`)],
  // command-line forms of consequential acts
  ["git_release", "cli", /\b(?:git|gh)\s+(?:push|merge|tag|rebase|release)\b|\bgit\s+reset\s+--hard\b|\bgh\s+pr\s+(?:merge|close)\b|\bvercel\b[^.;!?\n]*--prod\b|\bvercel\s+(?:deploy|promote|alias)\b|\b(?:npm|pnpm|yarn)\s+publish\b|\b(?:firebase|wrangler|supabase|fly|netlify)\s+(?:deploy|publish|db\s+push|db\s+reset)\b|\brm\s+-rf?\b/],
  ["git_release", "automerge", /\bauto[- ]?merge\b|\bpush\s+(?:the\s+)?tags\b|\btag\s+(?:a\s+|the\s+)?v?\d+\.\d+|\bfinali[sz]e\s+(?:the\s+)?release\b/],
  ["git_release", "live_switch", /\b(?:push|flip|switch|take|put|make|turn|set|send)\s+(?:it\s+|this\s+|that\s+|everything\s+|the\s+\w+\s+)?live(?!-(?:update|updates|updating|reload|reloading|region|search|chat|typing)\b|\w)|\bswitch\s+(?:prod|production)(?:\s+traffic)?\b|\bpoint\s+(?:the\s+)?(?:domain|dns|prod|production)\b|\bcut\s*over\b/],
  ["git_release", "act_conditionally", /\b(?:merge|deploy|ship|release|publish|launch|push)\s+(?:it\s+|this\s+|them\s+)?(?:if|once|when|after|as\s+soon\s+as)\b/],
  // the act must be a verb: not a noun use ("after THE merge"), and not the code terms "merge sort" / "merge conflicts"
  ["git_release", "conditional_act", new RegExp(`\\b(?:if|once|when|after|as\\s+soon\\s+as)\\b${W}{0,60}?(?<!\\b(?:the|a|an|this|that|our|my|its)\\s)\\b(?:merge|deploy|ship|release|publish|launch|push)\\b(?![-\\w])(?!\\s+(?:sort|sorting|conflicts?)\\b)`)],
  // bare or broad communication to people
  ["external_comms", "send_it", /\bsend\s+(?:it|them|this|that|these|those)(?=\s*$|\s*[.;!?,]|\s+(?:out|off|to\b|now|today|tonight|over|along))|\bfire\s+(?:it|them|this)\s+off\b|\bblast(?:s|ed|ing)?\b(?!\s+radius)|\bmass[- ]?(?:email|text|dm|message)/],
  ["external_comms", "notify_people", /\b(?:notify|notifies|notified|notifying|email|e-mail|emailing|text|texting|dm|message|ping|contact|invite)\s+(?:all\s+(?:of\s+)?(?:the\s+|our\s+)?|every\s+|the\s+|our\s+|my\s+)?(?:\d+\s+)?(?:customers?|clients?|leads?|users?|parents?|coach(?:es)?|subscribers?|prospects?|athletes?|swimmers?|everyone|everybody|investors?|partners?|vendors?|dispensar(?:y|ies)|members?)\b|\b(?:notify|email|e-mail|text|dm|message|ping|contact)\s+(?:the|our|my|whole|entire|mailing|email)\s+(?:mailing\s+|email\s+)?list\b|\breach(?:es|ing)?\s+out\s+to\b|\btweet(?:s|ed|ing)?\b|\bpost(?:s|ed|ing)?\s+(?:the|a|this|that|it|our|my)\s+(?:reel|video|post|story|announcement|photo|update|thread|tweet|carousel|teaser|drop)\b|\bsend\b[^.;!?\n]{0,40}\bto\s+(?:all\s+|the\s+|every\s+|our\s+)?(?:customers?|clients?|leads?|users|parents|coaches|subscribers?|prospects?|list|everyone|investors)\b/],
  // broad money
  ["financial", "money_broad", /\bwire\s+(?:the\s+)?(?:money|funds|payment|cash|\$|\d)|\bsettle\s+(?:up\b|(?:the\s+|that\s+|this\s+)?(?:invoice|bill|balance|debt|tab|account))|\bcharge\s+(?:them|him|her|the\s+customer|the\s+client|\$|\d)|\b(?:issue|process|send|make|approve)\s+(?:a\s+|the\s+)?(?:refund|payout|payment|transfer|deposit)s?\b|\bpay\s*out\b|\b(?:venmo|zelle|cash\s?app|paypal)\s+(?:\w+\s+){0,6}?(?:\$|\d|them|him|her|me|us|the\s+money)|\b(?:send|pay|transfer)\b[^.;!?\n]{0,40}\b(?:via|on|through|with|over)\s+(?:venmo|zelle|cash\s?app|paypal)\b|\b(?:invoice|bill)\s+(?:them|him|her|the\s+client|the\s+customer)\b/],
  // broad destruction of real data
  ["destructive_data", "destroy_broad", /\b(?:kill|wipe|reset|remove|delete|drop|truncate|purge|erase|nuke|destroy|clear)\b\s+(?:\w+\s+){0,3}?(?:database|databases|db|firestore|supabase|prod|production|backups?|records|customer\s+data|user\s+data|users|customers|leads|bucket|buckets|storage|tables?|collections?|accounts?)\b/],
  ["mission_lifecycle", "close_out", /\bclose\s+out\s+(?:the\s+|this\s+)?mission\b/],
  // passive or future forms of a consequential act ("it should be merged", "get it deployed", "have it published")
  ["git_release", "passive_act", /\b(?:be|been|get|gets|getting|got|have\s+it|has\s+it|have\s+this)\s+(?:it\s+)?(?:merged|deployed|released|shipped|launched|promoted|pushed\s+to\s+(?:origin\s+)?(?:main|master|prod|production))\b/],
  ["external_comms", "passive_send", /\b(?:be|been|get|gets|getting|got|have\s+it|has\s+it|have\s+them)\s+(?:it\s+|them\s+)?(?:sent|posted|published|emailed)\b/],
  ["financial", "passive_money", /\b(?:be|been|get|gets|getting|got|have\s+it|has\s+it)\s+(?:it\s+)?(?:paid|refunded|charged|purchased)\b/],
  // approval in any verb form
  ["approval", "approve_forms", /\b(?:approv(?:e|es|ed|ing)|green[- ]?light(?:s|ed|ing)?)\b(?!\s+(?:button|flow|logic|page|endpoint|modal|state|status|queue|step|workflow|component|handler|api|tests?|function|screen|ui|view|banner|template|reviewers?|count|badge|column|field|icon|check|checks))|\bsign(?:s|ed|ing)?\s+off(?:\s+on)?\b|^lgtm\b|\blgtm[.! ]*$|\b(?:give|has|have|you\s+have)\s+(?:it\s+)?(?:my\s+)?approval\b|\bmy\s+approval\s+(?:for|to|on)\b/],
];

/* 3/4. generic authority verbs (base form), and the code objects they may act on harmlessly */
const VERB = "(?:approve|reject|merge|deploy|release|publish|cancel|delete|pay|refund|sign(?: off)?|accept|ship|launch|land|promote|roll ?out|(?:force[ -])?push(?: it)? to (?:origin )?(?:main|master|prod|production)|verify(?= (?:m-\\d|(?:the |this )?mission\\b)))";
const OBJECT = "(?=\\s*$|\\s*[.;!?\\n,:]|\\s+(?:and|then|it|this|that|them|these|those|the|a|an|my|our|its|pr\\d*|prs|pull|to|on|into|prod|production|staging|live|v\\d[\\w.]*|now|everything|all|mission|m-\\d+|#?\\d+)\\b)";
const AT_START = new RegExp(`^${VERB}(?![-\\w])${OBJECT}`);
const ANYWHERE = new RegExp(`\\b${VERB}(?![-\\w])`, "g");
const CODE_OBJECT = /^\s+(?:(?:the|a|an|all|any|every|unused|old|stale|dead|duplicate|internal|local|two|both|each|those|these)\s+)*(?:lock|locks|mutex|semaphore|arrays?|lists?|objects?|maps?|dicts?|imports?|timers?|timeouts?|intervals?|listeners?|handlers?|functions?|methods?|resources?|memory|handles?|connections?|sockets?|variables?|vars?|props?|state|cache|caches|buffers?|streams?|promises?|events?|event\s+listeners?|branches?\s+locally|script|scripts|buttons?|flow|logic|pages?|endpoints?|modals?|steps?|workflows?|components?|tests?|configs?|hooks?|queues?|workers?|types?|interfaces?|code|lines?|comments?|todos?|files?|folders?|directories|dependencies|deps|sort|sorting|css|styles?|classes|class|fields?|columns?|rows?|keys\s+in|entries|items|nodes|edges|requests?|jobs?\s+in\s+the\s+queue|commits?\s+locally|stash|logs?|dialog|toast|spinner|subscription\s+(?:in|on)|effect)\b/;
const LEAD = /^(?:(?:claude[ -]?code|claude|codex|chat ?gpt|gpt-?\d[\w.]*|openai|perplexity|open ?claw|@[a-z][a-z0-9_-]*|please|pls|kindly|ok|okay|go ahead(?: and)?|go|now|also|just|then|and|so|can you|could you|you|hey|i|we|let's|lets)\b[\s,:]*)+/;
const CLAUSES = /[.;!?\n,:]|\band\b|\bthen\b/;

/** A code noun within the verb's object ("delete the leads FILTER COMPONENT"): at most two words before it. */
const CODE_IN_OBJECT = new RegExp(String.raw`^\s+(?:(?:the|a|an|this|that|old|new|unused|stale)\s+)?(?:[\w-]+\s+){0,2}?` + CODE_NOUNS + String.raw`\b`);
/**
 * A verb aimed at a code object. Every verb accepts the strict CODE_OBJECT list ("release the lock", "merge the
 * arrays"). Only delete and cancel also accept a code noun up to two words in ("delete the leads filter component"),
 * and only when the clause names no people, money or data. Merge, deploy, ship, release, land, publish and the rest
 * never take that wider allowance ("deploy the new pricing page to prod" stays the founder's).
 */
function verbAimedAtCode(t: string, verbStart: number, verbEnd: number): boolean {
  const rest = t.slice(verbEnd);
  const verb = t.slice(verbStart, verbEnd);
  if (NEVER_CODE_VERB.test(verb)) return false;
  if (CONSEQUENTIAL_CONTEXT.test(rest.split(/[.;!?\n]/)[0])) return false;
  if (verb === "release") return RELEASE_CODE_OBJECT.test(rest);
  if (verb === "publish") return PUBLISH_CODE_OBJECT.test(rest);
  if (CODE_OBJECT.test(rest)) return true;
  const obj = CODE_IN_OBJECT.exec(rest);
  return /^(?:delete|cancel)$/.test(verb) && !!obj && !PEOPLE_DATA.test(rest.slice(obj[0].length).split(/[.;!?\n]/)[0]);
}

/** Characters that look like Latin letters (Cyrillic, Greek), mapped so look-alike spellings cannot dodge the rules. */
const CONFUSABLE: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "к": "k", "м": "m", "т": "t", "н": "h", "в": "b",
  "α": "a", "ε": "e", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "ν": "v", "κ": "k", "ι": "i",
};
/**
 * Canonical text for routing: Unicode NFKC, lower case, look-alikes mapped, zero-width characters removed, the ship /
 * rocket emoji read as words, whitespace canonicalized, THEN separated-letter words joined ("m  e  r  g  e",
 * "m\te\tr\tg\te", "d.e.p.l.o.y" -> "merge" / "deploy"), and "merge-it" -> "merge it". Whitespace is canonical before
 * the letter join, so repeated spaces, tabs or newlines between letters cannot dodge the rules.
 */
export function canonicalCommand(text: string): string {
  let t = text.normalize("NFKC").toLowerCase().replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, "");
  t = [...t].map((ch) => CONFUSABLE[ch] ?? ch).join("");
  t = t.replace(/\u{1F6A2}/gu, " ship it ").replace(/\u{1F680}/gu, " launch it ");
  // 1. canonical whitespace: every run of spaces, tabs or newlines becomes one space
  t = t.replace(/\s+/g, " ");
  // 2. separated letters, deliberately: a run of at least three SINGLE letters, each separated by spaces, dots, dashes,
  //    underscores, slashes or asterisks ("m e r g e", "d.e.p.l.o.y", "r-e-f-u-n-d"), is one word. Each letter must
  //    stand alone (no letter on either side), so ordinary words and abbreviations inside words are never joined.
  t = t.replace(/(?<![a-z0-9])[a-z](?:[ ._\-/*]+[a-z](?![a-z0-9])){2,}/g, (m) => m.replace(/[^a-z]/g, ""));
  // 3. "merge-it" -> "merge it"
  t = t.replace(/\b([a-z]+)-(it|this|that|them)\b/g, "$1 $2");
  return t.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}

export function authorityFinding(t: string, handlerNamed: boolean): AuthorityFinding | null {
  // Security: a verb-led act is exempt only for a tiny code-noun list; a bare credential mention may name code
  // ("password reset form") unless a recipient is named. Direct negation never hides a later act (matchesFrom).
  for (const { re, verbLed } of SECURITY_RULES) {
    for (const m of matchesFrom(re, t)) {
      const at = m.index;
      if (NEGATED.test(t.slice(0, at))) continue;
      const after = t.slice(at + m[0].length);
      // A verb-led act on a credential is never exempt; a bare credential mention may name code unless it is disclosed.
      if (!verbLed && CODE_AFTER.test(after) && !RECIPIENT.test(clauseRest(t, at)) && !CREDENTIAL_DISCLOSURE.test(t.split(/[.;!?\n]/).find((c) => c.includes(m[0])) ?? t)) continue;
      return { kind: "security_decision", category: "security", rule: "security_or_authorization" };
    }
  }

  for (const [category, rule, re] of STRONG) {
    for (const m of matchesFrom(re, t)) {
      if (blocked(t.slice(0, m.index))) continue;
      if (strongExempt(rule, t, m.index, m[0])) continue;
      return { kind: "founder_authority", category, rule };
    }
  }

  for (const clause of t.split(CLAUSES)) {
    const c = clause.trim().replace(LEAD, "").trim();
    const m = AT_START.exec(c);
    if (m && !verbAimedAtCode(c, 0, m[0].length)) return { kind: "founder_authority", category: "authority_verb", rule: "clause_verb" };
  }

  if (handlerNamed) {
    for (const m of t.matchAll(ANYWHERE)) {
      const at = m.index ?? 0;
      if (!blocked(t.slice(0, at)) && !verbAimedAtCode(t, at, at + m[0].length)) {
        return { kind: "founder_authority", category: "authority_verb", rule: "named_handler_verb" };
      }
    }
  }
  return null;
}
