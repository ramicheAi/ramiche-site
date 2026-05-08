#!/bin/bash
# Agent Pulse Monitor — Data Generator
# Run this to regenerate the dashboard with fresh data
# Usage: bash generate-pulse.sh

set -e

OUTDIR="$(cd "$(dirname "$0")" && pwd)"
OUTFILE="$OUTDIR/pulse.html"
DATAFILE="$OUTDIR/pulse-data.json"

# Collect OpenClaw status
STATUS_JSON=$(openclaw status --json 2>/dev/null)

# Collect workspace code stats
CODE_STATS=$(python3 << 'PYEOF'
import os, json
agents = ['main','aetherion','echo','haven','ink','kiyosaki','maestro','mercury','nova','prophets','proximon','selah','shuri','simons','strange','swimelite','triage','vee','widow']
exts = {'.py','.js','.ts','.tsx','.html','.sh','.css','.json'}
skip = {'node_modules','.git','package-lock.json','pnpm-lock.yaml'}
results = {}
for a in agents:
    d = '/Users/admin/.openclaw/workspace' if a == 'main' else f'/Users/admin/.openclaw/workspace-{a}'
    count = 0
    total_size = 0
    for root, dirs, files in os.walk(d):
        dirs[:] = [x for x in dirs if x not in skip]
        for f in files:
            if f in skip:
                continue
            _, ext = os.path.splitext(f)
            if ext in exts:
                fp = os.path.join(root, f)
                count += 1
                try:
                    total_size += os.path.getsize(fp)
                except:
                    pass
    results[a] = {'files': count, 'bytes': total_size}
print(json.dumps(results))
PYEOF
)

# Collect system vitals
LOAD=$(sysctl -n vm.loadavg 2>/dev/null | tr -d '{}' | xargs)
MEMSIZE=$(sysctl -n hw.memsize 2>/dev/null)
FREE_PAGES=$(vm_stat 2>/dev/null | grep "Pages free" | awk '{print $3}' | tr -d '.')
INACTIVE_PAGES=$(vm_stat 2>/dev/null | grep "Pages inactive" | awk '{print $3}' | tr -d '.')
UPTIME=$(uptime | sed 's/.*up /up /' | sed 's/,.*//')

# Build combined JSON
python3 << PYEOF > "$DATAFILE"
import json, time

status = json.loads('''$STATUS_JSON''')
code_stats = json.loads('''$CODE_STATS''')

agents_raw = status.get('agents', {}).get('agents', [])
recent_sessions = status.get('sessions', {}).get('recent', [])
gw = status.get('gateway', {})
mem = status.get('memory', {})
sec = status.get('securityAudit', {}).get('summary', {})

# Map sessions to agents
session_map = {}
for s in recent_sessions:
    aid = s.get('agentId', '')
    if aid not in session_map:
        session_map[aid] = []
    session_map[aid].append({
        'key': s.get('key', ''),
        'kind': s.get('kind', ''),
        'inputTokens': s.get('inputTokens', 0),
        'outputTokens': s.get('outputTokens', 0),
        'totalTokens': s.get('totalTokens', 0),
        'remainingTokens': s.get('remainingTokens', 0),
        'percentUsed': s.get('percentUsed', 0),
        'model': s.get('model', ''),
        'contextTokens': s.get('contextTokens', 0),
    })

agents_out = []
for a in agents_raw:
    aid = a['id']
    cs = code_stats.get(aid, {'files': 0, 'bytes': 0})
    agents_out.append({
        'id': aid,
        'name': a.get('name', aid),
        'sessionsCount': a.get('sessionsCount', 0),
        'lastActiveAgeMs': a.get('lastActiveAgeMs', 0),
        'codeFiles': cs['files'],
        'codeBytes': cs['bytes'],
        'sessions': session_map.get(aid, []),
    })

output = {
    'generatedAt': int(time.time() * 1000),
    'gateway': {
        'version': gw.get('self', {}).get('version', ''),
        'host': gw.get('self', {}).get('host', ''),
        'reachable': gw.get('reachable', False),
        'latencyMs': gw.get('connectLatencyMs', 0),
        'platform': gw.get('self', {}).get('platform', ''),
    },
    'memory': {
        'files': mem.get('files', 0),
        'chunks': mem.get('chunks', 0),
        'provider': mem.get('provider', ''),
    },
    'security': sec,
    'totalSessions': status.get('sessions', {}).get('count', 0),
    'system': {
        'loadAvg': '$LOAD',
        'memoryGB': round($MEMSIZE / 1073741824, 1),
        'uptime': '$UPTIME',
    },
    'agents': agents_out,
}
print(json.dumps(output, indent=2))
PYEOF

echo "Data saved to $DATAFILE"
echo "Generating dashboard..."

# Now generate the HTML with embedded data
python3 << 'PYEOF' > "$OUTFILE"
import json

with open("DATAFILE_PLACEHOLDER", "r") as f:
    data = json.load(f)

# The HTML template with embedded data
html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Pulse Monitor — RAMICHE HQ</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    background: #0a0a0f;
    color: #e0e0e0;
    min-height: 100vh;
    padding: 20px;
}
.header {
    text-align: center;
    padding: 30px 20px;
    border-bottom: 1px solid #1a1a2e;
    margin-bottom: 30px;
}
.header h1 {
    font-size: 28px;
    background: linear-gradient(135deg, #00d4ff, #7b2ff7, #ff6b6b);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
    letter-spacing: 2px;
}
.header .subtitle {
    color: #666;
    font-size: 12px;
    letter-spacing: 1px;
}
.vitals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
}
.vital-card {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 18px;
    text-align: center;
}
.vital-card .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #555;
    margin-bottom: 8px;
}
.vital-card .value {
    font-size: 24px;
    font-weight: 700;
}
.vital-card .value.green { color: #00e676; }
.vital-card .value.blue { color: #00d4ff; }
.vital-card .value.yellow { color: #ffd740; }
.vital-card .value.red { color: #ff5252; }
.vital-card .value.purple { color: #7b2ff7; }
.section-title {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #555;
    margin-bottom: 15px;
    padding-left: 5px;
}
.agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
}
.agent-card {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 18px;
    transition: border-color 0.2s;
    position: relative;
    overflow: hidden;
}
.agent-card:hover { border-color: #333; }
.agent-card .pulse-dot {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.pulse-dot.active {
    background: #00e676;
    box-shadow: 0 0 8px #00e676;
    animation: pulse 2s ease-in-out infinite;
}
.pulse-dot.idle {
    background: #555;
}
.pulse-dot.warn {
    background: #ffd740;
    box-shadow: 0 0 8px #ffd740;
}
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
.agent-card .name {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 4px;
}
.agent-card .agent-id {
    font-size: 10px;
    color: #555;
    margin-bottom: 12px;
}
.agent-card .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.agent-card .stat {
    background: #0a0a0f;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
}
.agent-card .stat .stat-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #555;
    margin-bottom: 4px;
}
.agent-card .stat .stat-value {
    font-size: 16px;
    font-weight: 600;
}
.agent-card .model-tag {
    display: inline-block;
    margin-top: 10px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 10px;
    letter-spacing: 0.5px;
}
.model-tag.opus { background: #2d1b69; color: #b388ff; }
.model-tag.sonnet { background: #1b3a69; color: #82b1ff; }
.model-tag.deepseek { background: #1b4332; color: #69f0ae; }
.model-tag.gemini { background: #3e2723; color: #ffab91; }
.model-tag.kimi { background: #1a237e; color: #8c9eff; }
.model-tag.glm { background: #4a148c; color: #ea80fc; }
.model-tag.haiku { background: #263238; color: #80cbc4; }
.model-tag.default { background: #1a1a2e; color: #888; }
.ctx-bar {
    margin-top: 10px;
    height: 6px;
    background: #1a1a2e;
    border-radius: 3px;
    overflow: hidden;
}
.ctx-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
}
.ctx-bar-fill.low { background: #00e676; }
.ctx-bar-fill.mid { background: #ffd740; }
.ctx-bar-fill.high { background: #ff5252; }
.footer {
    text-align: center;
    padding: 20px;
    color: #333;
    font-size: 11px;
    letter-spacing: 1px;
}
.leaderboard {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
}
.lb-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #0a0a0f;
}
.lb-row:last-child { border-bottom: none; }
.lb-rank { color: #555; width: 30px; font-size: 12px; }
.lb-name { flex: 1; font-weight: 600; font-size: 14px; }
.lb-bar {
    width: 120px;
    height: 8px;
    background: #1a1a2e;
    border-radius: 4px;
    overflow: hidden;
    margin: 0 15px;
}
.lb-bar-fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, #7b2ff7, #00d4ff);
}
.lb-value { color: #888; font-size: 12px; width: 80px; text-align: right; }
</style>
</head>
<body>
<div class="header">
    <h1>AGENT PULSE MONITOR</h1>
    <div class="subtitle">RAMICHE HQ &mdash; ECOSYSTEM HEALTH DASHBOARD</div>
    <div class="subtitle" style="margin-top:6px" id="timestamp"></div>
</div>

<div class="vitals" id="vitals"></div>

<div class="section-title">CODE OUTPUT LEADERBOARD</div>
<div class="leaderboard" id="leaderboard"></div>

<div class="section-title">AGENT STATUS</div>
<div class="agents-grid" id="agents-grid"></div>

<div class="footer">
    TRIAGE &mdash; YOLO BUILD #001 &mdash; AGENT PULSE MONITOR<br>
    Built overnight while Ramon slept. The healer watches the body.
</div>

<script>
const DATA = __DATA_PLACEHOLDER__;

function formatBytes(b) {
    if (b === 0) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
}

function formatAge(ms) {
    if (ms < 60000) return Math.round(ms/1000) + 's ago';
    if (ms < 3600000) return Math.round(ms/60000) + 'm ago';
    if (ms < 86400000) return Math.round(ms/3600000) + 'h ago';
    return Math.round(ms/86400000) + 'd ago';
}

function getModelClass(model) {
    if (!model) return 'default';
    model = model.toLowerCase();
    if (model.includes('opus')) return 'opus';
    if (model.includes('sonnet')) return 'sonnet';
    if (model.includes('deepseek')) return 'deepseek';
    if (model.includes('gemini')) return 'gemini';
    if (model.includes('kimi')) return 'kimi';
    if (model.includes('glm')) return 'glm';
    if (model.includes('haiku')) return 'haiku';
    return 'default';
}

function getModelShort(model) {
    if (!model) return 'N/A';
    const parts = model.split('/');
    return parts[parts.length - 1];
}

// Timestamp
const ts = new Date(DATA.generatedAt);
document.getElementById('timestamp').textContent =
    'Snapshot: ' + ts.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short'
    });

// Vitals
const vitalsEl = document.getElementById('vitals');
const totalCode = DATA.agents.reduce((s, a) => s + a.codeFiles, 0);
const totalBytes = DATA.agents.reduce((s, a) => s + a.codeBytes, 0);
const activeAgents = DATA.agents.filter(a => a.lastActiveAgeMs < 300000).length;
const totalTokensUsed = DATA.agents.reduce((s, a) => {
    return s + a.sessions.reduce((ss, ses) => ss + ses.totalTokens, 0);
}, 0);

const vitals = [
    { label: 'Gateway', value: DATA.gateway.reachable ? 'ONLINE' : 'DOWN', cls: DATA.gateway.reachable ? 'green' : 'red' },
    { label: 'Version', value: DATA.gateway.version, cls: 'blue' },
    { label: 'Agents', value: DATA.agents.length, cls: 'purple' },
    { label: 'Sessions', value: DATA.totalSessions, cls: 'blue' },
    { label: 'Active Now', value: activeAgents + '/' + DATA.agents.length, cls: activeAgents > 5 ? 'green' : 'yellow' },
    { label: 'Code Files', value: totalCode.toLocaleString(), cls: 'green' },
    { label: 'Code Size', value: formatBytes(totalBytes), cls: 'blue' },
    { label: 'Load Avg', value: DATA.system.loadAvg, cls: 'yellow' },
    { label: 'Memory', value: DATA.system.memoryGB + ' GB', cls: 'blue' },
    { label: 'Security', value: DATA.security.critical + ' crit / ' + DATA.security.warn + ' warn', cls: DATA.security.critical > 0 ? 'red' : 'green' },
];

vitals.forEach(v => {
    vitalsEl.innerHTML += '<div class="vital-card"><div class="label">' + v.label +
        '</div><div class="value ' + v.cls + '">' + v.value + '</div></div>';
});

// Leaderboard (sorted by code bytes, excluding main)
const lb = document.getElementById('leaderboard');
const sorted = DATA.agents.filter(a => a.id !== 'main').sort((a, b) => b.codeBytes - a.codeBytes);
const maxBytes = sorted.length > 0 ? sorted[0].codeBytes : 1;

sorted.forEach((a, i) => {
    const pct = maxBytes > 0 ? (a.codeBytes / maxBytes * 100) : 0;
    lb.innerHTML += '<div class="lb-row">' +
        '<span class="lb-rank">#' + (i+1) + '</span>' +
        '<span class="lb-name">' + a.name + '</span>' +
        '<div class="lb-bar"><div class="lb-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="lb-value">' + a.codeFiles + ' files / ' + formatBytes(a.codeBytes) + '</span>' +
        '</div>';
});

// Agent Cards
const grid = document.getElementById('agents-grid');
DATA.agents.forEach(a => {
    const isActive = a.lastActiveAgeMs < 300000;
    const isWarn = !isActive && a.lastActiveAgeMs < 3600000;
    const pulseClass = isActive ? 'active' : (isWarn ? 'warn' : 'idle');

    let model = 'N/A';
    let modelClass = 'default';
    let ctxPct = 0;
    let tokenInfo = '';

    if (a.sessions.length > 0) {
        const s = a.sessions[0];
        model = getModelShort(s.model);
        modelClass = getModelClass(s.model);
        ctxPct = s.percentUsed;
        tokenInfo = (s.totalTokens/1000).toFixed(0) + 'K / ' + (s.contextTokens/1000).toFixed(0) + 'K';
    }

    const ctxClass = ctxPct > 80 ? 'high' : (ctxPct > 50 ? 'mid' : 'low');

    grid.innerHTML += '<div class="agent-card">' +
        '<div class="pulse-dot ' + pulseClass + '"></div>' +
        '<div class="name">' + a.name + '</div>' +
        '<div class="agent-id">' + a.id + ' &middot; ' + formatAge(a.lastActiveAgeMs) + '</div>' +
        '<div class="stats">' +
            '<div class="stat"><div class="stat-label">Sessions</div><div class="stat-value">' + a.sessionsCount + '</div></div>' +
            '<div class="stat"><div class="stat-label">Code Files</div><div class="stat-value">' + a.codeFiles + '</div></div>' +
            '<div class="stat"><div class="stat-label">Code Size</div><div class="stat-value">' + formatBytes(a.codeBytes) + '</div></div>' +
            '<div class="stat"><div class="stat-label">Tokens</div><div class="stat-value">' + (tokenInfo || 'N/A') + '</div></div>' +
        '</div>' +
        '<span class="model-tag ' + modelClass + '">' + model + '</span>' +
        (ctxPct > 0 ? '<div class="ctx-bar"><div class="ctx-bar-fill ' + ctxClass + '" style="width:' + ctxPct + '%"></div></div>' : '') +
    '</div>';
});
</script>
</body>
</html>""";

print(html.replace('__DATA_PLACEHOLDER__', json.dumps(data)))
PYEOF

sed -i '' "s|DATAFILE_PLACEHOLDER|$DATAFILE|g" "$OUTFILE"

echo "Dashboard generated at $OUTFILE"
echo "Open with: open $OUTFILE"
