#!/usr/bin/env node

// Sync PIPELINE.md files to Command Center Firestore tasks
// Run: node sync-pipeline.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const PIPELINE_DIR = path.join(PROJECT_ROOT, 'public', 'projects');

// Firestore REST API config
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'apex-athlete-73755';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET;
const BRIDGE_URL = 'http://localhost:3000/api/bridge';

if (!BRIDGE_SECRET) {
  console.warn('⚠️  BRIDGE_API_SECRET not set — using Firestore direct');
}

// Map project names to agents
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

// Parse PIPELINE.md into structured tasks
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
      } else if (phase.includes('Blocked') || phase.includes('White-Label')) {
        inPhase = false;
      }
      continue;
    }
    
    // Task items: [ ] or - with priority tags
    const taskMatch = line.match(/^[*-]\s+(?:\[[ x]\]\s+)?(.+)/);
    if (taskMatch && inPhase) {
      const taskText = taskMatch[1].trim();
      
      // Extract priority tags
      let priority = 'MEDIUM';
      let assignee = PROJECT_AGENTS[projectName] || 'ATLAS';
      let title = taskText;
      
      if (taskText.includes('HIGH') || taskText.includes('🛡️')) {
        priority = 'HIGH';
      } else if (taskText.includes('CRITICAL') || taskText.includes('🕷️')) {
        priority = 'CRITICAL';
      } else if (taskText.includes('LOW')) {
        priority = 'LOW';
      }
      
      // Extract agent mentions
      const agentMatch = taskText.match(/\(([A-Za-z\s\+]+)\)/);
      if (agentMatch) {
        assignee = agentMatch[1].replace(/\+/g, ' + ').trim();
      }
      
      // Clean up title
      title = title.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();
      
      tasks.push({
        id: `${projectName}-${tasks.length + 1}`,
        title: `${projectName.toUpperCase()}: ${title}`,
        description: `Phase: ${currentPhase}\nProject: ${projectName}`,
        priority,
        assignee,
        avatar: getAvatar(assignee),
        accent: getAccentColor(assignee),
        tags: [projectName, currentPhase.split(' ')[0]?.toLowerCase() || 'general'],
        status: 'backlog', // Default to backlog
        createdAt: new Date().toISOString(),
        project: projectName,
        phase: currentPhase,
      });
    }
    
    // Sprint flow sections (QUEUED, IN PROGRESS, REVIEW, DEPLOY, VERIFIED)
    const flowMatch = line.match(/^#{4}\s+(QUEUED|IN PROGRESS|REVIEW|DEPLOY|VERIFIED)/i);
    if (flowMatch) {
      currentPhase = `Sprint: ${flowMatch[1]}`;
      inPhase = true;
    }
  }
  
  return tasks;
}

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

async function syncToBridge(tasks) {
  const bridgeTasks = {
    backlog: tasks.filter(t => t.status === 'backlog'),
    'in-progress': tasks.filter(t => t.status === 'in-progress'),
    review: tasks.filter(t => t.status === 'review'),
    done: tasks.filter(t => t.status === 'done'),
  };
  
  const payload = {
    type: 'tasks',
    data: bridgeTasks,
  };
  
  try {
    console.log(`📤 Syncing ${tasks.length} tasks to bridge...`);
    
    if (BRIDGE_SECRET) {
      const response = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-secret': BRIDGE_SECRET,
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        console.log('✅ Synced to bridge API');
        return true;
      } else {
        console.error(`❌ Bridge API error: ${response.status}`);
        return false;
      }
    } else {
      // Fallback: Direct Firestore write
      console.warn('📝 Writing directly to Firestore (no bridge secret)');
      
      const fields = toFirestoreFields({
        ...bridgeTasks,
        _syncedAt: new Date().toISOString(),
        _source: 'pipeline-sync',
      });
      
      const firestoreRes = await fetch(`${FIRESTORE_BASE}/command-center/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      
      if (firestoreRes.ok) {
        console.log('✅ Written to Firestore');
        return true;
      } else {
        console.error(`❌ Firestore error: ${firestoreRes.status}`);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    return false;
  }
}

// Firestore fields helper
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(v => ({
            mapValue: { fields: toFirestoreFields(v) }
          }))
        }
      };
    } else if (typeof value === 'object' && value !== null) {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

// Main execution
async function main() {
  console.log('🔍 Scanning pipeline files...');
  
  const pipelineFiles = fs.readdirSync(PIPELINE_DIR)
    .filter(dir => fs.statSync(path.join(PIPELINE_DIR, dir)).isDirectory())
    .map(dir => path.join(PIPELINE_DIR, dir, 'PIPELINE.md'))
    .filter(file => fs.existsSync(file));
  
  console.log(`📂 Found ${pipelineFiles.length} pipeline files`);
  
  const allTasks = [];
  
  for (const file of pipelineFiles) {
    try {
      const projectName = path.basename(path.dirname(file));
      const content = fs.readFileSync(file, 'utf8');
      const tasks = parsePipeline(projectName, content);
      
      console.log(`  ${projectName}: ${tasks.length} tasks`);
      allTasks.push(...tasks);
    } catch (error) {
      console.error(`  ❌ Error reading ${file}:`, error.message);
    }
  }
  
  if (allTasks.length === 0) {
    console.log('⚠️  No tasks found in pipeline files');
    return;
  }
  
  console.log(`📊 Total tasks: ${allTasks.length}`);
  
  // Sync to bridge/Firestore
  const success = await syncToBridge(allTasks);
  
  if (success) {
    console.log('🚀 Pipeline sync complete!');
    console.log('📊 Check Command Center → Tasks page');
  } else {
    console.log('❌ Sync failed');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { parsePipeline, syncToBridge };