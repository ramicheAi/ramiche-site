#!/usr/bin/env node

// Test pipeline parsing logic

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const PIPELINE_DIR = path.join(PROJECT_ROOT, 'public', 'projects');

const PROJECT_AGENTS = {
  'command-center': 'SHURI',
  'parallax-site': 'PROXIMON',
  'parallax-publish': 'ATLAS',
  'mettle': 'MICHAEL',
  'clawguard': 'WIDOW',
  'galactik-antics': 'ATLAS',
  'ramiche-studio': 'TheMAESTRO',
  'scoww': 'ATLAS',
  'verified-agents': 'ATLAS',
  'parallax': 'AETHERION',
};

function getAvatar(assignee) {
  const avatars = {
    SHURI: '🛡️',
    ATLAS: '🤖',
    PROXIMON: '🏗️',
    WIDOW: '🕷️',
    MICHAEL: '🏊',
    TheMAESTRO: '🎵',
    AETHERION: '🌀',
    'SHURI + WIDOW': '🛡️🕷️',
    'SHURI + ECHO': '🛡️📡',
    'SHURI + VEE': '🛡️📊',
    'SHURI + MAESTRO': '🛡️🎵',
    'SHURI + SELAH': '🛡️🧘',
    'SHURI + NOVA': '🛡️🔧',
  };
  return avatars[assignee] || '🤖';
}

function getAccentColor(assignee) {
  const colors = {
    SHURI: '#8b5cf6',
    ATLAS: '#C9A84C',
    PROXIMON: '#f97316',
    WIDOW: '#ef4444',
    MICHAEL: '#06b6d4',
    TheMAESTRO: '#f59e0b',
    AETHERION: '#818cf8',
    'SHURI + WIDOW': '#ef4444',
    'SHURI + ECHO': '#06b6d4',
    'SHURI + VEE': '#f59e0b',
    'SHURI + MAESTRO': '#f472b6',
    'SHURI + SELAH': '#a78bfa',
    'SHURI + NOVA': '#22d3ee',
  };
  return colors[assignee] || '#6b7280';
}

function parsePipeline(projectName, content) {
  const tasks = [];
  const lines = content.split('\n');
  
  let currentPhase = '';
  let inPhase = false;
  
  for (const line of lines) {
    // Phase headers
    const phaseMatch = line.match(/^#{2,3}\s+(.+)/);
    if (phaseMatch) {
      const phase = phaseMatch[1].trim();
      if (phase.includes('Current Phase') || phase.includes('Phase')) {
        currentPhase = phase;
        inPhase = true;
        console.log(`📌 Phase: ${phase}`);
      } else if (phase.includes('Blocked') || phase.includes('White-Label')) {
        inPhase = false;
      }
      continue;
    }
    
    // Task items
    const taskMatch = line.match(/^[*-]\s+(?:\[[ x]\]\s+)?(.+)/);
    if (taskMatch && inPhase) {
      const taskText = taskMatch[1].trim();
      
      if (taskText.includes('Blocked') || taskText.includes('White-Label')) {
        continue;
      }
      
      let priority = 'MEDIUM';
      let assignee = PROJECT_AGENTS[projectName] || 'ATLAS';
      let title = taskText;
      
      if (taskText.includes('HIGH') && taskText.includes('🛡️')) {
        priority = 'HIGH';
      } else if (taskText.includes('CRITICAL') && taskText.includes('🕷️')) {
        priority = 'CRITICAL';
      } else if (taskText.includes('MEDIUM')) {
        priority = 'MEDIUM';
      } else if (taskText.includes('LOW')) {
        priority = 'LOW';
      }
      
      const agentMatch = taskText.match(/\(([A-Za-z\s\+]+)\)/);
      if (agentMatch) {
        assignee = agentMatch[1].replace(/\+/g, ' + ').trim();
      } else {
        const boardAgentMatch = taskText.match(/[🛡️🤖🏗️🕷️🏊🎵🌀📡📊🧘🔧]+\s*([A-Za-z\s\+]+)/);
        if (boardAgentMatch) {
          assignee = boardAgentMatch[1].trim();
        }
      }
      
      title = title
        .replace(/\([^)]+\)/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/[🛡️🤖🏗️🕷️🏊🎵🌀📡📊🧘🔧]/g, '')
        .replace(/\b(HIGH|MEDIUM|LOW|CRITICAL)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!title) continue;
      
      let status = 'backlog';
      const phaseLower = currentPhase.toLowerCase();
      if (phaseLower.includes('in progress')) {
        status = 'in-progress';
      } else if (phaseLower.includes('review')) {
        status = 'review';
      } else if (phaseLower.includes('deploy') || phaseLower.includes('verified')) {
        status = 'done';
      }
      
      tasks.push({
        id: `${projectName}-${tasks.length}`,
        title: title.length > 60 ? `${title.substring(0, 57)}...` : title,
        priority,
        assignee,
        avatar: getAvatar(assignee),
        accent: getAccentColor(assignee),
        tags: [projectName],
        status,
        phase: currentPhase,
      });
      
      console.log(`  📝 ${priority} ${assignee}: ${title}`);
    }
    
    // Sprint flow sections
    const flowMatch = line.match(/^#{4}\s+(QUEUED|IN PROGRESS|REVIEW|DEPLOY|VERIFIED)/i);
    if (flowMatch) {
      currentPhase = `Sprint: ${flowMatch[1]}`;
      inPhase = true;
      console.log(`📌 Sprint Phase: ${flowMatch[1]}`);
    }
  }
  
  return tasks;
}

// Main test
async function main() {
  console.log('🧪 Testing pipeline parsing...\n');
  
  const file = path.join(PIPELINE_DIR, 'command-center', 'PIPELINE.md');
  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    return;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  const tasks = parsePipeline('command-center', content);
  
  console.log(`\n✅ Parsed ${tasks.length} tasks`);
  console.log('Status breakdown:');
  const statusCount = {};
  tasks.forEach(t => {
    statusCount[t.status] = (statusCount[t.status] || 0) + 1;
  });
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

main().catch(console.error);