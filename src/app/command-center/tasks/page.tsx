"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   TASK BOARD — Kanban sub-page of Command Center
   Drag-and-drop task management across Backlog → In Progress → Review → Done
   ══════════════════════════════════════════════════════════════════════════════ */

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  assignee: string;
  avatar: string;
  accent: string;
  tags: string[];
}

type ColumnId = "backlog" | "in-progress" | "review" | "done";

interface Column {
  id: ColumnId;
  label: string;
  icon: string;
  accent: string;
}

const COLUMNS: Column[] = [
  { id: "backlog", label: "Backlog", icon: "📋", accent: "#6b7280" },
  { id: "in-progress", label: "In Progress", icon: "⚡", accent: "#f59e0b" },
  { id: "review", label: "Review", icon: "🔍", accent: "#8b5cf6" },
  { id: "done", label: "Done", icon: "✅", accent: "#22c55e" },
];

const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  HIGH: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  MEDIUM: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  LOW: { color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

const INITIAL_TASKS: Record<ColumnId, Task[]> = {
  backlog: [
    {
      id: "2.1", title: "2.1 Settings — agent list",
      description: "Wire Settings page agent list to show all 20 agents with live status",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["settings", "frontend"],
    },
    {
      id: "2.2", title: "2.2 Settings — model changes",
      description: "Let users swap LLM models per agent from the Settings page",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["settings", "frontend"],
    },
    {
      id: "2.3", title: "2.3 Task board — wire pipeline",
      description: "Replace static placeholder tasks with real PIPELINE.md data",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["tasks", "frontend"],
    },
    {
      id: "2.4", title: "2.4 Task board — approve / reject",
      description: "Add approve/reject workflow so tasks move through review with feedback",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["tasks", "frontend"],
    },
    {
      id: "2.5", title: "2.5 Task board — holographic redesign",
      description: "Redesign task board with holographic sci-fi aesthetic matching Command Center",
      priority: "MEDIUM", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["tasks", "design"],
    },
    {
      id: "2.6", title: "2.6 Security — wire ClawGuard",
      description: "Connect Security page to ClawGuard real-time threat monitoring",
      priority: "CRITICAL", assignee: "SHURI + WIDOW", avatar: "🕷️", accent: "#ef4444",
      tags: ["security", "integration"],
    },
    {
      id: "2.7", title: "2.7 Security — audit",
      description: "Full security audit of Command Center auth, API routes, and data access",
      priority: "HIGH", assignee: "ATLAS", avatar: "🤖", accent: "#C9A84C",
      tags: ["security", "audit"],
    },
    {
      id: "3.1", title: "3.1 Specialty group chats",
      description: "Enable multi-agent group chat channels for cross-team collaboration",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["chat", "frontend"],
    },
    {
      id: "3.2", title: "3.2 Legal update",
      description: "Update legal pages with latest terms, privacy policy, and compliance docs",
      priority: "MEDIUM", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["legal", "content"],
    },
    {
      id: "3.3", title: "3.3 Strategy QA",
      description: "QA pass on Strategy page — verify data accuracy and UI consistency",
      priority: "MEDIUM", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["strategy", "qa"],
    },
    {
      id: "3.4", title: "3.4 Strategy — war room",
      description: "Build interactive war room view for real-time strategy collaboration",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["strategy", "frontend"],
    },
    {
      id: "4.1", title: "4.1 Content Publish",
      description: "Ship content publishing pipeline — draft, review, publish workflow",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["content", "publishing"],
    },
    {
      id: "4.2", title: "4.2 Social scanner",
      description: "Build social media monitoring dashboard with sentiment analysis",
      priority: "MEDIUM", assignee: "SHURI + ECHO", avatar: "📡", accent: "#06b6d4",
      tags: ["social", "integration"],
    },
    {
      id: "4.3", title: "4.3 Meta ads",
      description: "Integrate Meta Ads manager for campaign creation and performance tracking",
      priority: "MEDIUM", assignee: "SHURI + VEE", avatar: "📊", accent: "#f59e0b",
      tags: ["ads", "integration"],
    },
    {
      id: "4.4", title: "4.4 Baba Studio",
      description: "Launch Baba Studio — AI-assisted music production and beat creation",
      priority: "MEDIUM", assignee: "SHURI + MAESTRO", avatar: "🎵", accent: "#f472b6",
      tags: ["studio", "creative"],
    },
    {
      id: "4.5", title: "4.5 Wellness",
      description: "Build wellness dashboard — meditation, journaling, and mood tracking",
      priority: "LOW", assignee: "SHURI + SELAH", avatar: "🧘", accent: "#a78bfa",
      tags: ["wellness", "lifestyle"],
    },
    {
      id: "4.6", title: "4.6 Fabrication",
      description: "Launch Fabrication lab — 3D printing, prototyping, and design tools",
      priority: "LOW", assignee: "SHURI + NOVA", avatar: "🔧", accent: "#22d3ee",
      tags: ["fabrication", "creative"],
    },
  ],
  "in-progress": [],
  review: [],
  done: [
    {
      id: "1.1", title: "1.1 Fix realtime chat",
      description: "Fixed Supabase realtime subscriptions — messages now stream instantly",
      priority: "CRITICAL", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["chat", "realtime"],
    },
    {
      id: "1.2", title: "1.2 Fix DM routing",
      description: "Fixed agent DM routing — messages reach the correct agent channel",
      priority: "CRITICAL", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["chat", "routing"],
    },
    {
      id: "1.3", title: "1.3 Fix typing indicator",
      description: "Fixed typing indicator for all chat types — clears on error",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["chat", "ux"],
    },
    {
      id: "1.4", title: "1.4 Show all 20 agents",
      description: "Sidebar now displays all 20 agents with correct avatars and status",
      priority: "HIGH", assignee: "SHURI", avatar: "🛡️", accent: "#8b5cf6",
      tags: ["sidebar", "agents"],
    },
    {
      id: "1.5", title: "1.5 Sidebar layout",
      description: "Rebuilt sidebar layout — collapsible sections, responsive, clean hierarchy",
      priority: "HIGH", assignee: "ATLAS", avatar: "🤖", accent: "#C9A84C",
      tags: ["sidebar", "layout"],
    },
  ],
};

export default function TaskBoardPage() {
  const [columns, setColumns] = useState<Record<ColumnId, Task[]>>(INITIAL_TASKS);
  const [draggedTask, setDraggedTask] = useState<{ task: Task; fromCol: ColumnId } | null>(null);
  const [dropTarget, setDropTarget] = useState<ColumnId | null>(null);
  const dragCounter = useRef<Record<string, number>>({});
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState("Atlas");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("MEDIUM");
  const [reviseTask, setReviseTask] = useState<Task | null>(null);
  const [reviseFeedback, setReviseFeedback] = useState("");

  // Fetch live tasks from bridge API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch("/api/bridge?type=tasks");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.tasks && typeof data.tasks === "object") {
          const live: Record<ColumnId, Task[]> = { backlog: [], "in-progress": [], review: [], done: [] };
          for (const col of COLUMNS) {
            if (Array.isArray(data.tasks[col.id])) {
              live[col.id] = data.tasks[col.id];
            }
          }
          const total = Object.values(live).reduce((s, a) => s + a.length, 0);
          if (total > 0) setColumns(live);
        }
      } catch {}
    };
    fetchTasks();
    const iv = setInterval(fetchTasks, 60000);
    return () => clearInterval(iv);
  }, []);

  // Persist task move to API + trigger agent when starting
  const persistMove = async (task: Task, fromCol: ColumnId, toCol: ColumnId) => {
    try {
      if (toCol === "in-progress" && task.assignee) {
        // Single call: moves task to in-progress AND triggers the agent
        await fetch("/api/bridge", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trigger",
            taskId: task.id,
            fromCol,
            agent: task.assignee,
            title: task.title,
            description: task.description,
          }),
        });
      } else {
        await fetch("/api/bridge", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move", taskId: task.id, fromCol, toCol }),
        });
      }
    } catch {}
  };

  // Create new task
  const createTask = async () => {
    if (!newTitle.trim()) return;
    const task: Task = {
      id: `t${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      assignee: newAssignee,
      avatar: "🤖",
      accent: "#C9A84C",
      tags: [],
    };
    setColumns((prev) => ({ ...prev, backlog: [...prev.backlog, task] }));
    setShowNewTask(false);
    setNewTitle("");
    setNewDesc("");
    try {
      await fetch("/api/bridge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tasks", taskId: task.id, update: { ...task, status: "backlog" } }),
      });
    } catch {}
  };

  // Send revision back to agent with feedback
  const submitRevision = async (task: Task) => {
    if (!reviseFeedback.trim()) return;
    // Move task back to in-progress
    quickAction(task, "review", "in-progress");
    // Trigger agent re-spawn with feedback via bridge API
    try {
      await fetch("/api/bridge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger",
          taskId: task.id,
          fromCol: "review",
          agent: task.assignee,
          title: `[REVISION] ${task.title}`,
          description: `REVISION FEEDBACK: ${reviseFeedback.trim()}. Original task: ${task.description}`,
        }),
      });
    } catch {}
    setReviseTask(null);
    setReviseFeedback("");
  };

  // Quick action: move task to next column + trigger agent
  const quickAction = (task: Task, fromCol: ColumnId, toCol: ColumnId) => {
    if (fromCol === toCol) return;
    setColumns((prev) => {
      const fromTasks = prev[fromCol].filter((t) => t.id !== task.id);
      const toTasks = [...prev[toCol], task];
      return { ...prev, [fromCol]: fromTasks, [toCol]: toTasks };
    });
    persistMove(task, fromCol, toCol);
  };

  const handleDragStart = useCallback((e: React.DragEvent, task: Task, fromCol: ColumnId) => {
    setDraggedTask({ task, fromCol });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.4";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedTask(null);
    setDropTarget(null);
    dragCounter.current = {};
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault();
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) + 1;
    setDropTarget(colId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault();
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) - 1;
    if (dragCounter.current[colId] <= 0) {
      dragCounter.current[colId] = 0;
      if (dropTarget === colId) setDropTarget(null);
    }
  }, [dropTarget]);

  const handleDrop = useCallback((e: React.DragEvent, toCol: ColumnId) => {
    e.preventDefault();
    setDropTarget(null);
    dragCounter.current = {};
    if (!draggedTask) return;
    if (draggedTask.fromCol === toCol) return;

    setColumns((prev) => {
      const fromTasks = prev[draggedTask.fromCol].filter((t) => t.id !== draggedTask.task.id);
      const toTasks = [...prev[toCol], draggedTask.task];
      return { ...prev, [draggedTask.fromCol]: fromTasks, [toCol]: toTasks };
    });
    persistMove(draggedTask.task, draggedTask.fromCol, toCol);
    setDraggedTask(null);
  }, [draggedTask]);

  /* ── Mobile: tap-to-move ───────────────────────────────────────────────── */
  const [mobileMenu, setMobileMenu] = useState<{ task: Task; fromCol: ColumnId } | null>(null);

  const moveTask = useCallback((task: Task, fromCol: ColumnId, toCol: ColumnId) => {
    if (fromCol === toCol) return;
    setColumns((prev) => {
      const fromTasks = prev[fromCol].filter((t) => t.id !== task.id);
      const toTasks = [...prev[toCol], task];
      return { ...prev, [fromCol]: fromTasks, [toCol]: toTasks };
    });
    setMobileMenu(null);
  }, []);

  const totalTasks = Object.values(columns).reduce((sum, col) => sum + col.length, 0);
  const doneTasks = columns.done.length;

  return (
    <div className="min-h-screen relative" style={{ background: "#0a0a0f" }}>
      <ParticleField variant="cyan" opacity={0.25} count={40} connections />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <Link
              href="/command-center"
              className="text-sm mb-2 inline-block transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              ← Command Center
            </Link>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "#e2e8f0" }}
            >
              Task Board
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Drag tasks between columns to update status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewTask(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
              style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "2px solid rgba(201,168,76,0.3)" }}
            >
              + New Task
            </button>
            <div
              className="flex items-center gap-3 px-4 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Progress
            </div>
            <div
              className="w-32 h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #22c55e, #4ade80)",
                }}
              />
            </div>
            <div className="text-sm font-mono" style={{ color: "#22c55e" }}>
              {doneTasks}/{totalTasks}
            </div>
          </div>
          </div>
        </div>

        {/* ── Kanban Columns ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const tasks = columns[col.id];
            const isOver = dropTarget === col.id && draggedTask?.fromCol !== col.id;

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl transition-all duration-200"
                style={{
                  background: isOver ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  border: isOver
                    ? `2px solid ${col.accent}40`
                    : "2px solid rgba(255,255,255,0.04)",
                  minHeight: 300,
                }}
                onDragEnter={(e) => handleDragEnter(e, col.id)}
                onDragOver={handleDragOver}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <span
                      className="text-sm font-semibold tracking-wide uppercase"
                      style={{ color: col.accent }}
                    >
                      {col.label}
                    </span>
                  </div>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: `${col.accent}20`, color: col.accent }}
                  >
                    {tasks.length}
                  </span>
                </div>

                {/* Task Cards */}
                <div className="flex-1 px-3 pb-3 space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task, col.id)}
                      onDragEnd={handleDragEnd}
                      className="rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-150 hover:scale-[1.02] group"
                      style={{
                        background: "#12121a",
                        border: `2px solid ${task.accent}25`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${task.accent}60`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${task.accent}25`;
                      }}
                    >
                      {/* Priority + Assignee */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            color: PRIORITY_STYLES[task.priority].color,
                            background: PRIORITY_STYLES[task.priority].bg,
                          }}
                        >
                          {task.priority}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{task.avatar}</span>
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: task.accent }}
                          >
                            {task.assignee}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-sm font-semibold mb-1 leading-snug"
                        style={{ color: "#e2e8f0" }}
                      >
                        {task.title}
                      </h3>

                      {/* Description */}
                      <p
                        className="text-xs leading-relaxed mb-2"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {task.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-1.5 mt-2">
                        {col.id === "backlog" && (
                          <button
                            className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                            onClick={() => quickAction(task, col.id, "in-progress")}
                          >
                            Start
                          </button>
                        )}
                        {col.id === "in-progress" && (
                          <button
                            className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                            style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.25)" }}
                            onClick={() => quickAction(task, col.id, "review")}
                          >
                            Submit for Review
                          </button>
                        )}
                        {col.id === "review" && (
                          <>
                            <button
                              className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                              onClick={() => quickAction(task, col.id, "done")}
                            >
                              Approve
                            </button>
                            <button
                              className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                              style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                              onClick={() => { setReviseTask(task); setReviseFeedback(""); }}
                            >
                              Revise
                            </button>
                          </>
                        )}
                        {col.id !== "done" && (
                          <button
                            className="text-[10px] py-1.5 px-2 rounded-lg transition-colors md:hidden"
                            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
                            onClick={() => setMobileMenu({ task, fromCol: col.id })}
                          >
                            Move
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {tasks.length === 0 && (
                    <div
                      className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed text-xs"
                      style={{
                        borderColor: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.2)",
                      }}
                    >
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── New Task Modal ────────────────────────────────────────────────── */}
      {showNewTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowNewTask(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "#12121a", border: "2px solid rgba(201,168,76,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>New Task</h2>
            <input
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "2px solid rgba(255,255,255,0.08)" }}
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm resize-none"
              style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "2px solid rgba(255,255,255,0.08)" }}
              placeholder="Description"
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-3">
              <select
                className="flex-1 px-3 py-2 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "2px solid rgba(255,255,255,0.08)" }}
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Task["priority"])}
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <input
                className="flex-1 px-3 py-2 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "2px solid rgba(255,255,255,0.08)" }}
                placeholder="Assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "2px solid rgba(201,168,76,0.3)" }}
                onClick={createTask}
              >
                Create Task
              </button>
              <button
                className="px-6 py-3 rounded-xl text-sm"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onClick={() => setShowNewTask(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revision Feedback Modal ──────────────────────────────────────── */}
      {reviseTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setReviseTask(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "#12121a", border: "2px solid rgba(245,158,11,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>
              Revise: {reviseTask.title}
            </h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Tell {reviseTask.assignee} what needs to change. They&apos;ll be re-spawned with your feedback.
            </p>
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm resize-none"
              style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "2px solid rgba(255,255,255,0.08)" }}
              placeholder="What needs to change?"
              rows={4}
              value={reviseFeedback}
              onChange={(e) => setReviseFeedback(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "2px solid rgba(245,158,11,0.3)" }}
                onClick={() => submitRevision(reviseTask)}
              >
                Send Revision
              </button>
              <button
                className="px-6 py-3 rounded-xl text-sm"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onClick={() => setReviseTask(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Move Menu (overlay) ───────────────────────────────────── */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMobileMenu(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-4 pb-8 space-y-2"
            style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-3" style={{ color: "#e2e8f0" }}>
              Move &quot;{mobileMenu.task.title}&quot;
            </div>
            {COLUMNS.filter((c) => c.id !== mobileMenu.fromCol).map((col) => (
              <button
                key={col.id}
                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: col.accent,
                  border: `1px solid ${col.accent}30`,
                }}
                onClick={() => moveTask(mobileMenu.task, mobileMenu.fromCol, col.id)}
              >
                {col.icon} {col.label}
              </button>
            ))}
            <button
              className="w-full text-center px-4 py-3 rounded-xl text-sm mt-2"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onClick={() => setMobileMenu(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
