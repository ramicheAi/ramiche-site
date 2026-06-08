"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ParticleField from "@/components/ParticleField";
import { InstrumentPage, Panel, PgBtn } from "@/components/command-center/po/Instrument";

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

export default function TaskBoardPage() {
  const [columns, setColumns] = useState<Record<ColumnId, Task[]>>({
    backlog: [],
    "in-progress": [],
    review: [],
    done: [],
  });
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

  // Fetch live tasks from projects API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // Fetch all projects from the projects API
        const res = await fetch("/api/command-center/projects");
        if (res.ok) {
          const data = await res.json();
          const projects = data.projects || [];

          // Convert project tasks to task board format
          const live: Record<ColumnId, Task[]> = { backlog: [], "in-progress": [], review: [], done: [] };

          projects.forEach((project: { slug: string; name: string; description?: string; tasks?: { t: string; done: boolean }[]; priority?: number; lead?: string; accent?: string; tags?: string[]; state?: string }) => {
            if (!Array.isArray(project.tasks)) return;

            project.tasks.forEach((taskItem: { t: string; done: boolean }, idx: number) => {
              const task: Task = {
                id: `${project.slug}-${idx}`,
                title: taskItem.t,
                description: `${project.name} — ${project.description || ""}`.slice(0, 150),
                priority: (project.priority === 1 ? "CRITICAL" : project.priority === 2 ? "HIGH" : project.priority === 3 ? "MEDIUM" : "LOW") as Task["priority"],
                assignee: project.lead || "Atlas",
                avatar: "🤖",
                accent: project.accent || "#C9A84C",
                tags: [project.slug, ...(project.tags || [])].slice(0, 3),
              };

              // Distribute tasks based on done status and project state
              if (taskItem.done) {
                live.done.push(task);
              } else if (project.state === "active") {
                live["in-progress"].push(task);
              } else {
                live.backlog.push(task);
              }
            });
          });

          setColumns(live);
        }
      } catch {}
    };
    fetchTasks();
    const iv = setInterval(fetchTasks, 15000);
    return () => clearInterval(iv);
  }, []);

  const notifyTaskOutcome = useCallback(
    async (
      kind: "approve" | "reject" | "revise",
      task: Task,
      reason?: string
    ) => {
      try {
        await fetch("/api/command-center/tasks/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            taskId: task.id,
            title: task.title,
            description: task.description,
            assignee: task.assignee,
            reason,
          }),
        });
      } catch {
        /* best-effort */
      }
    },
    []
  );

  const persistMove = useCallback(
    async (task: Task, fromCol: ColumnId, toCol: ColumnId) => {
      try {
        if (toCol === "in-progress" && task.assignee) {
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
        if (fromCol === "review" && toCol === "done") {
          void notifyTaskOutcome("approve", task);
        }
        if (fromCol === "review" && toCol === "backlog") {
          void notifyTaskOutcome("reject", task);
        }
      } catch {}
    },
    [notifyTaskOutcome]
  );

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
        body: JSON.stringify({
          action: "create",
          task: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignee: task.assignee,
            accent: task.accent,
            tags: task.tags,
            avatar: task.avatar,
          },
        }),
      });
    } catch {}
  };

  const submitRevision = async (task: Task) => {
    if (!reviseFeedback.trim()) return;
    const fb = reviseFeedback.trim();
    setColumns((prev) => {
      const fromTasks = prev.review.filter((t) => t.id !== task.id);
      const moved = { ...task, title: `[REVISION] ${task.title}` };
      return { ...prev, review: fromTasks, "in-progress": [...prev["in-progress"], moved] };
    });
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
          description: `REVISION FEEDBACK: ${fb}. Original task: ${task.description}`,
        }),
      });
    } catch {}
    void notifyTaskOutcome("revise", task, fb);
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

  const handleDrop = useCallback(
    (e: React.DragEvent, toCol: ColumnId) => {
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
      void persistMove(draggedTask.task, draggedTask.fromCol, toCol);
      setDraggedTask(null);
    },
    [draggedTask, persistMove]
  );

  /* ── Mobile: tap-to-move ───────────────────────────────────────────────── */
  const [mobileMenu, setMobileMenu] = useState<{ task: Task; fromCol: ColumnId } | null>(null);

  const moveTask = useCallback(
    (task: Task, fromCol: ColumnId, toCol: ColumnId) => {
      if (fromCol === toCol) return;
      setColumns((prev) => {
        const fromTasks = prev[fromCol].filter((t) => t.id !== task.id);
        const toTasks = [...prev[toCol], task];
        return { ...prev, [fromCol]: fromTasks, [toCol]: toTasks };
      });
      setMobileMenu(null);
      void persistMove(task, fromCol, toCol);
    },
    [persistMove]
  );

  const totalTasks = Object.values(columns).reduce((sum, col) => sum + col.length, 0);
  const doneTasks = columns.done.length;

  return (
    <InstrumentPage
      id="tasks"
      title="Tasks"
      section="Operations"
      icon="tasks"
      accent="var(--c-amber)"
      actions={
        <div className="flex items-center gap-3">
          <PgBtn icon="spark" onClick={() => setShowNewTask(true)}>New Task</PgBtn>
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-xl"
            style={{ background: "var(--ink-2)", border: "1px solid var(--line)" }}
          >
            <div className="text-sm" style={{ color: "var(--t-mid)" }}>
              Progress
            </div>
            <div
              className="w-32 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--line)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`,
                  background: "linear-gradient(90deg, var(--c-green), var(--c-teal))",
                }}
              />
            </div>
            <div className="text-sm" style={{ color: "var(--c-green)", fontFamily: "var(--f-mono)" }}>
              {doneTasks}/{totalTasks}
            </div>
          </div>
        </div>
      }
    >
      <ParticleField variant="cyan" opacity={0.25} count={40} connections />
      <p className="text-sm" style={{ color: "var(--t-mid)", margin: "0 0 20px" }}>
        Drag tasks between columns to update status
      </p>

      <Panel>
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
                  background: isOver ? "var(--ink-2)" : "var(--ink-1)",
                  border: isOver
                    ? `2px solid ${col.accent}40`
                    : "2px solid var(--line)",
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
                        background: "var(--ink-2)",
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
                        style={{ color: "var(--t-hi)" }}
                      >
                        {task.title}
                      </h3>

                      {/* Description */}
                      <p
                        className="text-xs leading-relaxed mb-2"
                        style={{ color: "var(--t-mid)" }}
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
                              background: "var(--ink-1)",
                              color: "var(--t-lo)",
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
                            style={{ background: "color-mix(in srgb, var(--c-amber) 15%, transparent)", color: "var(--c-amber)", border: "1px solid color-mix(in srgb, var(--c-amber) 25%, transparent)" }}
                            onClick={() => quickAction(task, col.id, "in-progress")}
                          >
                            Start
                          </button>
                        )}
                        {col.id === "in-progress" && (
                          <button
                            className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                            style={{ background: "color-mix(in srgb, var(--c-purple) 15%, transparent)", color: "var(--c-purple)", border: "1px solid color-mix(in srgb, var(--c-purple) 25%, transparent)" }}
                            onClick={() => quickAction(task, col.id, "review")}
                          >
                            Submit for Review
                          </button>
                        )}
                        {col.id === "review" && (
                          <>
                            <button
                              className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                              style={{ background: "color-mix(in srgb, var(--c-green) 15%, transparent)", color: "var(--c-green)", border: "1px solid color-mix(in srgb, var(--c-green) 25%, transparent)" }}
                              onClick={() => quickAction(task, col.id, "done")}
                            >
                              Approve
                            </button>
                            <button
                              className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                              style={{ background: "color-mix(in srgb, var(--c-red) 15%, transparent)", color: "var(--c-red)", border: "1px solid color-mix(in srgb, var(--c-red) 25%, transparent)" }}
                              onClick={() => quickAction(task, col.id, "backlog")}
                            >
                              Reject
                            </button>
                            <button
                              className="flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                              style={{ background: "color-mix(in srgb, var(--c-amber) 15%, transparent)", color: "var(--c-amber)", border: "1px solid color-mix(in srgb, var(--c-amber) 25%, transparent)" }}
                              onClick={() => { setReviseTask(task); setReviseFeedback(""); }}
                            >
                              Revise
                            </button>
                          </>
                        )}
                        {col.id !== "done" && (
                          <button
                            className="text-[10px] py-1.5 px-2 rounded-lg transition-colors md:hidden"
                            style={{ background: "var(--ink-1)", color: "var(--t-mid)", border: "1px solid var(--line)" }}
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
                        borderColor: "var(--line)",
                        color: "var(--t-lo)",
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
      </Panel>

      {/* ── New Task Modal ────────────────────────────────────────────────── */}
      {showNewTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowNewTask(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "var(--ink-1)", border: "2px solid var(--line-2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--t-hi)" }}>New Task</h2>
            <input
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: "var(--ink-2)", color: "var(--t-hi)", border: "2px solid var(--line)" }}
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm resize-none"
              style={{ background: "var(--ink-2)", color: "var(--t-hi)", border: "2px solid var(--line)" }}
              placeholder="Description"
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-3">
              <select
                className="flex-1 px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--ink-2)", color: "var(--t-hi)", border: "2px solid var(--line)" }}
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
                style={{ background: "var(--ink-2)", color: "var(--t-hi)", border: "2px solid var(--line)" }}
                placeholder="Assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ background: "color-mix(in srgb, var(--c-amber) 15%, transparent)", color: "var(--c-amber)", border: "2px solid color-mix(in srgb, var(--c-amber) 30%, transparent)" }}
                onClick={createTask}
              >
                Create Task
              </button>
              <button
                className="px-6 py-3 rounded-xl text-sm"
                style={{ color: "var(--t-mid)" }}
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
            style={{ background: "var(--ink-1)", border: "2px solid color-mix(in srgb, var(--c-amber) 25%, transparent)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--t-hi)" }}>
              Revise: {reviseTask.title}
            </h2>
            <p className="text-xs" style={{ color: "var(--t-mid)" }}>
              Tell {reviseTask.assignee} what needs to change. They&apos;ll be re-spawned with your feedback.
            </p>
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm resize-none"
              style={{ background: "var(--ink-2)", color: "var(--t-hi)", border: "2px solid var(--line)" }}
              placeholder="What needs to change?"
              rows={4}
              value={reviseFeedback}
              onChange={(e) => setReviseFeedback(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ background: "color-mix(in srgb, var(--c-amber) 15%, transparent)", color: "var(--c-amber)", border: "2px solid color-mix(in srgb, var(--c-amber) 30%, transparent)" }}
                onClick={() => submitRevision(reviseTask)}
              >
                Send Revision
              </button>
              <button
                className="px-6 py-3 rounded-xl text-sm"
                style={{ color: "var(--t-mid)" }}
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
            style={{ background: "var(--ink-1)", border: "1px solid var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-3" style={{ color: "var(--t-hi)" }}>
              Move &quot;{mobileMenu.task.title}&quot;
            </div>
            {COLUMNS.filter((c) => c.id !== mobileMenu.fromCol).map((col) => (
              <button
                key={col.id}
                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                style={{
                  background: "var(--ink-2)",
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
              style={{ color: "var(--t-lo)" }}
              onClick={() => setMobileMenu(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </InstrumentPage>
  );
}
