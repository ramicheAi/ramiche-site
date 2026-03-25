#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ROOT_DIR = '/Users/admin/.openclaw';

// Auto-detect inbox path
// Priority: 
// 1. workspace/agents/inbox.md (Atlas main)
// 2. workspace-aetherion/agents/inbox.md
// 3. Any other found
const CANDIDATE_PATHS = [
    'workspace/agents/inbox.md',
    'workspace-aetherion/agents/inbox.md',
    'workspace-proximon/agents/mailbox.md' // Proximon sometimes uses mailbox
];

function findRealInbox() {
    for (const p of CANDIDATE_PATHS) {
        const full = path.join(ROOT_DIR, p);
        if (fs.existsSync(full)) return full;
    }
    return null;
}

const REAL_INBOX = findRealInbox();

// Colors
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;

console.log(blue("=== Agent Swarm Health (ASH) v0.1 ==="));
console.log(`Time: ${new Date().toLocaleString()}`);

// 1. Inbox Latency Check
console.log(blue("\n[1] Message Relay Latency (All Inboxes)"));

// Find all inbox.md files
let inboxFiles = [];
try {
    const cmd = `find ${ROOT_DIR}/workspace*/agents -name "inbox.md" 2>/dev/null`;
    inboxFiles = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch (e) {
    inboxFiles = [REAL_INBOX].filter(Boolean);
}

if (inboxFiles.length === 0) {
    console.log(yellow("⚠ No inbox.md files found."));
} else {
    let globalPending = 0;
    
    inboxFiles.forEach(f => {
        const content = fs.readFileSync(f, 'utf8');
        const pendingRegex = /## \[(.*?)\] FROM: .*?\nSTATUS: pending/g;
        let match;
        let filePending = 0;
        let maxLag = 0;
        
        while ((match = pendingRegex.exec(content)) !== null) {
            filePending++;
            globalPending++;
            const tsStr = match[1]; // Expected: YYYY-MM-DD HH:MM
            const ts = new Date(tsStr).getTime();
            if (isNaN(ts)) continue; // Skip bad dates

            const now = Date.now();
            const diffMins = (now - ts) / 60000;
            if (diffMins > maxLag) maxLag = diffMins;
        }

        if (filePending > 0) {
            const agentName = path.dirname(path.dirname(f)).replace(/.*workspace-?/, '') || 'atlas';
            const shortPath = `${agentName}/inbox`;
            
            let statusIcon = yellow('⚠');
            if (maxLag > 60 || filePending > 3) statusIcon = red('✘ STUCK');
            
            console.log(`${statusIcon} ${agentName.padEnd(12)} : ${filePending} msg${filePending > 1 ? 's' : ' '}, max lag ${(maxLag/60).toFixed(1)}h`);
        }
    });

    if (globalPending === 0) {
        console.log(green(`✔ Scanned ${inboxFiles.length} inboxes. No pending messages.`));
    } else {
        console.log(yellow(`\nTotal pending messages: ${globalPending}`));
    }
}

// 2. Memory Freshness
console.log(blue("\n[2] Memory Freshness (Active Agents)"));
const agents = [
    'atlas', 'aetherion', 'proximon', 'maestro', 'shuri', 'vee', 'simons', 'strange'
];

agents.forEach(agent => {
    // Try to find workspace
    const wsNames = [`workspace-${agent}`, agent === 'atlas' ? 'workspace' : null].filter(Boolean);
    let memPath = null;
    for (const ws of wsNames) {
        const p = path.join(ROOT_DIR, ws, 'MEMORY.md');
        if (fs.existsSync(p)) {
            memPath = p;
            break;
        }
    }

    if (memPath) {
        const stats = fs.statSync(memPath);
        const hoursAgo = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        const timeStr = `${hoursAgo.toFixed(1)}h ago`;
        
        let status = green("✔");
        if (hoursAgo > 48) status = red("✘ STALE");
        else if (hoursAgo > 24) status = yellow("⚠ AGING");

        console.log(`${status} ${agent.padEnd(12)} : Updated ${timeStr}`);
    } else {
        // console.log(yellow(`? ${agent.padEnd(12)} : No MEMORY.md found`));
    }
});

// 3. Workspace Disk Usage
console.log(blue("\n[3] heavy-lifter Workspace Sizes"));
try {
    const cmd = `du -sh ${path.join(ROOT_DIR, 'workspace*')} | sort -hr | head -n 5`;
    const output = execSync(cmd, { encoding: 'utf8' });
    console.log(output.trim());
} catch (e) {
    console.log(yellow("Could not check disk usage."));
}

console.log(blue("\n=== End of Report ==="));
