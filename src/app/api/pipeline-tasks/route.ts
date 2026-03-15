// ── Pipeline Tasks API ───────────────────────────────────────────────
// Serve tasks parsed from PIPELINE.md files for Command Center task board

import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const PIPELINE_DIR = path.join(PROJECT_ROOT, 'public', 'projects');

// Map project names to agents
const PROJECT_AGENTS: Record<string, string> = {
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

interface PipelineTask {
  id: string;
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignee: string;
  avatar: string;
  accent: string;
  tags: string[];
  status: 'backlog' | 'in-progress' | 'review' | 'done';
  createdAt: string;
  project: string;
  phase: string;
}

function getAvatar(assignee: string): string {
  const avatars: Record<string, string> = {
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

function getAccentColor(assignee: string): string {
  const colors: Record<string, string> = {
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

function parsePipeline(projectName: string, content: string): PipelineTask[] {
  const tasks: PipelineTask[] = [];
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
    // Match: "- [ ] task" or "- task" or "* task"
    const taskMatch = line.match(/^[*-]\s+(?:\[[ x]\]\s+)?(.+)/);
    if (taskMatch && inPhase) {
      const taskText = taskMatch[1].trim();
      
      // Skip if it's a blocked item or note (contains "Blocked On" or "White-Label")
      if (taskText.includes('Blocked') || taskText.includes('White-Label')) {
        continue;
      }
      
      // Extract priority tags from task board pattern (e.g., "HIGH 🛡️SHURI")
      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      let assignee = PROJECT_AGENTS[projectName] || 'ATLAS';
      let title = taskText;
      
      // Check for priority markers from task board format
      if (taskText.includes('HIGH') && taskText.includes('🛡️')) {
        priority = 'HIGH';
      } else if (taskText.includes('CRITICAL') && taskText.includes('🕷️')) {
        priority = 'CRITICAL';
      } else if (taskText.includes('MEDIUM')) {
        priority = 'MEDIUM';
      } else if (taskText.includes('LOW')) {
        priority = 'LOW';
      }
      
      // Extract agent mentions from parentheses in pipeline format (e.g., "Architecture (PROXIMON)")
      const agentMatch = taskText.match(/\(([A-Za-z\s\+]+)\)/);
      if (agentMatch) {
        assignee = agentMatch[1].replace(/\+/g, ' + ').trim();
      } else {
        // Try to extract from task board format (e.g., "🛡️SHURI")
        const boardAgentMatch = taskText.match(/[🛡️🤖🏗️🕷️🏊🎵🌀📡📊🧘🔧]+\s*([A-Za-z\s\+]+)/);
        if (boardAgentMatch) {
          assignee = boardAgentMatch[1].trim();
        }
      }
      
      // Clean up title - remove parentheses, brackets, emojis, priority tags
      title = title
        .replace(/\([^)]+\)/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/[🛡️🤖🏗️🕷️🏊🎵🌀📡📊🧘🔧]/g, '')
        .replace(/\b(HIGH|MEDIUM|LOW|CRITICAL)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Determine status based on phase
      let status: 'backlog' | 'in-progress' | 'review' | 'done' = 'backlog';
      const phaseLower = currentPhase.toLowerCase();
      if (phaseLower.includes('in progress')) {
        status = 'in-progress';
      } else if (phaseLower.includes('review')) {
        status = 'review';
      } else if (phaseLower.includes('deploy') || phaseLower.includes('verified')) {
        status = 'done';
      }
      
      // Skip if title is empty after cleaning
      if (!title) continue;
      
      tasks.push({
        id: `${projectName}-${Date.now()}-${tasks.length}`,
        title: title.length > 60 ? `${title.substring(0, 57)}...` : title,
        description: `Project: ${projectName}\nPhase: ${currentPhase}\nOriginal: ${taskText}`,
        priority,
        assignee,
        avatar: getAvatar(assignee),
        accent: getAccentColor(assignee),
        tags: [projectName.replace('-', ' '), ...currentPhase.split(' ').slice(0, 2).map(w => w.toLowerCase())],
        status,
        createdAt: new Date().toISOString(),
        project: projectName,
        phase: currentPhase,
      });
    }
    
    // Sprint flow sections (### QUEUED, ### IN PROGRESS, etc.)
    const flowMatch = line.match(/^#{3,4}\s+(QUEUED|IN PROGRESS|REVIEW|DEPLOY|VERIFIED)/i);
    if (flowMatch) {
      currentPhase = `Sprint: ${flowMatch[1]}`;
      inPhase = true;
      continue;
    }
  }
  
  return tasks;
}

export async function GET(req: NextRequest) {
  try {
    // Read all PIPELINE.md files
    const pipelineFiles = fs.readdirSync(PIPELINE_DIR)
      .filter(dir => fs.statSync(path.join(PIPELINE_DIR, dir)).isDirectory())
      .map(dir => path.join(PIPELINE_DIR, dir, 'PIPELINE.md'))
      .filter(file => fs.existsSync(file));
    
    const allTasks: PipelineTask[] = [];
    
    for (const file of pipelineFiles) {
      try {
        const projectName = path.basename(path.dirname(file));
        const content = fs.readFileSync(file, 'utf8');
        const tasks = parsePipeline(projectName, content);
        allTasks.push(...tasks);
      } catch (error) {
        console.warn(`Error reading ${file}:`, error);
      }
    }
    
    // Group by status
    const groupedTasks = {
      backlog: allTasks.filter(t => t.status === 'backlog'),
      'in-progress': allTasks.filter(t => t.status === 'in-progress'),
      review: allTasks.filter(t => t.status === 'review'),
      done: allTasks.filter(t => t.status === 'done'),
    };
    
    return NextResponse.json({
      tasks: groupedTasks,
      count: allTasks.length,
      syncedAt: new Date().toISOString(),
      source: 'pipeline-files',
    });
  } catch (error) {
    console.error('Pipeline tasks API error:', error);
    return NextResponse.json({
      tasks: { backlog: [], 'in-progress': [], review: [], done: [] },
      error: String(error),
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';