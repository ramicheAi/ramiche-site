import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import mqtt from "mqtt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORKSPACE_DIR = join(
  process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace",
  "printers"
);
const STATUS_FILE = join(WORKSPACE_DIR, "bambu-status.json");

/* ── Types ─────────────────────────────────────────────────────────── */

interface PrinterJob {
  name: string;
  file: string;
  progress: number;
  timeElapsed: string;
  timeRemaining: string;
  layer: { current: number; total: number };
  startedAt: string;
}

interface RecentJob {
  name: string;
  status: "completed" | "failed" | "cancelled";
  duration: string;
  completedAt: string;
  material: string;
}

interface PrinterTemperature {
  current: number;
  target: number;
}

interface PrinterState {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  status: "online" | "offline" | "printing" | "error" | "idle";
  lastSeen: string | null;
  connection: {
    type: "mqtt";
    host: string;
    port: number;
    configured: boolean;
    accessCode: string;
  };
  temperatures: {
    nozzle: PrinterTemperature;
    bed: PrinterTemperature;
  };
  filament: {
    type: string;
    color: string;
    remaining: number;
  };
  currentJob: PrinterJob | null;
  recentJobs: RecentJob[];
  stats: {
    totalPrints: number;
    successRate: number;
    totalHours: number;
    filamentUsedKg: number;
  };
}

const DEFAULT_PRINTER: PrinterState = {
  id: "bambu-a1-001",
  name: "Bambu Lab A1",
  model: "A1",
  serialNumber: "",
  status: "offline",
  lastSeen: null,
  connection: { type: "mqtt", host: "", port: 8883, configured: false, accessCode: "" },
  temperatures: {
    nozzle: { current: 0, target: 0 },
    bed: { current: 0, target: 0 },
  },
  filament: { type: "PLA", color: "#ffffff", remaining: 100 },
  currentJob: null,
  recentJobs: [],
  stats: { totalPrints: 0, successRate: 0, totalHours: 0, filamentUsedKg: 0 },
};

/* ── Helpers ───────────────────────────────────────────────────────── */

function ensureDir(): void {
  if (!existsSync(WORKSPACE_DIR)) {
    mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

function readState(): PrinterState {
  ensureDir();
  if (!existsSync(STATUS_FILE)) return { ...DEFAULT_PRINTER };
  try {
    const raw = readFileSync(STATUS_FILE, "utf-8");
    return JSON.parse(raw) as PrinterState;
  } catch {
    return { ...DEFAULT_PRINTER };
  }
}

function writeState(state: PrinterState): void {
  ensureDir();
  writeFileSync(STATUS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ── MQTT Connection Manager ──────────────────────────────────────── */

let mqttClient: mqtt.MqttClient | null = null;
let mqttConnecting = false;

interface BambuPrintData {
  gcode_state?: string;
  mc_percent?: number;
  mc_remaining_time?: number;
  layer_num?: number;
  total_layer_num?: number;
  subtask_name?: string;
  gcode_file?: string;
  nozzle_temper?: number;
  nozzle_target_temper?: number;
  bed_temper?: number;
  bed_target_temper?: number;
  ams?: {
    ams?: Array<{
      tray?: Array<{
        tray_type?: string;
        tray_color?: string;
        remain?: number;
      }>;
    }>;
  };
}

function parseBambuReport(data: BambuPrintData, state: PrinterState): void {
  state.lastSeen = new Date().toISOString();

  if (data.nozzle_temper !== undefined)
    state.temperatures.nozzle.current = data.nozzle_temper;
  if (data.nozzle_target_temper !== undefined)
    state.temperatures.nozzle.target = data.nozzle_target_temper;
  if (data.bed_temper !== undefined)
    state.temperatures.bed.current = data.bed_temper;
  if (data.bed_target_temper !== undefined)
    state.temperatures.bed.target = data.bed_target_temper;

  if (data.ams?.ams?.[0]?.tray?.[0]) {
    const tray = data.ams.ams[0].tray[0];
    if (tray.tray_type) state.filament.type = tray.tray_type;
    if (tray.tray_color) state.filament.color = `#${tray.tray_color.slice(0, 6)}`;
    if (tray.remain !== undefined) state.filament.remaining = tray.remain;
  }

  const gcodeState = data.gcode_state?.toUpperCase();
  if (gcodeState === "RUNNING" || gcodeState === "PREPARE") {
    state.status = "printing";
    const progress = data.mc_percent ?? 0;
    const remaining = data.mc_remaining_time ?? 0;
    const layerCurrent = data.layer_num ?? 0;
    const layerTotal = data.total_layer_num ?? 0;

    if (!state.currentJob) {
      state.currentJob = {
        name: data.subtask_name || "Print Job",
        file: data.gcode_file || "unknown.gcode",
        progress,
        timeElapsed: "0m",
        timeRemaining: formatDuration(remaining * 60 * 1000),
        layer: { current: layerCurrent, total: layerTotal },
        startedAt: new Date().toISOString(),
      };
    } else {
      state.currentJob.progress = progress;
      state.currentJob.timeRemaining = formatDuration(remaining * 60 * 1000);
      state.currentJob.layer = { current: layerCurrent, total: layerTotal };
      if (data.subtask_name) state.currentJob.name = data.subtask_name;
      if (data.gcode_file) state.currentJob.file = data.gcode_file;

      const startMs = new Date(state.currentJob.startedAt).getTime();
      state.currentJob.timeElapsed = formatDuration(Date.now() - startMs);
    }
  } else if (gcodeState === "FINISH") {
    if (state.currentJob) {
      const startMs = new Date(state.currentJob.startedAt).getTime();
      state.recentJobs.unshift({
        name: state.currentJob.name,
        status: "completed",
        duration: formatDuration(Date.now() - startMs),
        completedAt: new Date().toISOString(),
        material: state.filament.type,
      });
      if (state.recentJobs.length > 20) state.recentJobs = state.recentJobs.slice(0, 20);
      state.stats.totalPrints += 1;
      const prevOk = Math.round((state.stats.successRate / 100) * (state.stats.totalPrints - 1));
      state.stats.successRate = Math.round(((prevOk + 1) / state.stats.totalPrints) * 100);
      state.currentJob = null;
    }
    state.status = "idle";
  } else if (gcodeState === "FAILED") {
    if (state.currentJob) {
      const startMs = new Date(state.currentJob.startedAt).getTime();
      state.recentJobs.unshift({
        name: state.currentJob.name,
        status: "failed",
        duration: formatDuration(Date.now() - startMs),
        completedAt: new Date().toISOString(),
        material: state.filament.type,
      });
      if (state.recentJobs.length > 20) state.recentJobs = state.recentJobs.slice(0, 20);
      state.stats.totalPrints += 1;
      const prevOk = Math.round((state.stats.successRate / 100) * (state.stats.totalPrints - 1));
      state.stats.successRate = Math.round((prevOk / state.stats.totalPrints) * 100);
      state.currentJob = null;
    }
    state.status = "error";
  } else if (gcodeState === "IDLE" || gcodeState === "PAUSE") {
    if (!state.currentJob) state.status = "idle";
    else if (gcodeState === "PAUSE") state.status = "printing";
  }

  writeState(state);
}

function connectMqtt(host: string, accessCode: string, serial: string): { ok: boolean; error?: string } {
  if (mqttClient) {
    try { mqttClient.end(true); } catch { /* swallow */ }
    mqttClient = null;
  }

  if (mqttConnecting) return { ok: false, error: "Connection already in progress" };
  mqttConnecting = true;

  try {
    const brokerUrl = `mqtts://${host}:8883`;
    const client = mqtt.connect(brokerUrl, {
      username: "bblp",
      password: accessCode,
      rejectUnauthorized: false,
      clientId: `cc-bambu-${Date.now()}`,
      connectTimeout: 10000,
      keepalive: 30,
      protocolVersion: 4,
    });

    const reportTopic = `device/${serial}/report`;
    const requestTopic = `device/${serial}/request`;

    client.on("connect", () => {
      mqttConnecting = false;
      client.subscribe(reportTopic, { qos: 0 });
      const pushAll = JSON.stringify({ pushing: { sequence_id: "0", command: "pushall" } });
      client.publish(requestTopic, pushAll, { qos: 0 });
    });

    client.on("message", (_topic: string, payload: Buffer) => {
      try {
        const msg = JSON.parse(payload.toString()) as { print?: BambuPrintData };
        if (msg.print) {
          const state = readState();
          parseBambuReport(msg.print, state);
        }
      } catch { /* malformed JSON from printer — skip */ }
    });

    client.on("error", () => {
      mqttConnecting = false;
      const state = readState();
      state.status = "error";
      state.lastSeen = new Date().toISOString();
      writeState(state);
    });

    client.on("close", () => {
      mqttConnecting = false;
    });

    client.on("offline", () => {
      const state = readState();
      state.status = "offline";
      writeState(state);
    });

    mqttClient = client;
    return { ok: true };
  } catch (e) {
    mqttConnecting = false;
    return { ok: false, error: String(e) };
  }
}

/* ── GET ───────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const state = readState();
    const mqttConnected = mqttClient !== null && mqttClient.connected;

    if (state.connection.configured && !mqttConnected && !mqttConnecting && state.connection.host) {
      const serial = state.serialNumber || state.id;
      connectMqtt(state.connection.host, state.connection.accessCode, serial);
    }

    return NextResponse.json({
      ok: true,
      printer: state,
      mqtt: {
        available: true,
        connected: mqttConnected,
        connecting: mqttConnecting,
        protocol: "mqtts (TLS)",
        note: mqttConnected
          ? "Live MQTT connection — real-time printer data"
          : state.connection.configured
            ? "MQTT configured — reconnecting…"
            : "Configure printer IP and access code to enable live MQTT",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/* ── POST ──────────────────────────────────────────────────────────── */

interface ConnectPayload { action: "connect"; host: string; accessCode?: string; serialNumber?: string; }
interface DisconnectPayload { action: "disconnect"; }
interface UpdateStatusPayload {
  action: "update-status";
  status?: PrinterState["status"];
  temperatures?: PrinterState["temperatures"];
  filament?: Partial<PrinterState["filament"]>;
  currentJob?: PrinterJob | null;
}
interface AddJobPayload { action: "add-job"; job: PrinterJob; }
interface CompleteJobPayload { action: "complete-job"; status: "completed" | "failed" | "cancelled"; duration: string; }

type ActionPayload = ConnectPayload | DisconnectPayload | UpdateStatusPayload | AddJobPayload | CompleteJobPayload;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ActionPayload;
    const state = readState();

    switch (body.action) {
      case "connect": {
        state.connection.host = body.host;
        state.connection.accessCode = body.accessCode || "";
        state.connection.configured = true;
        if (body.serialNumber) state.serialNumber = body.serialNumber;

        const serial = state.serialNumber || state.id;
        const result = connectMqtt(body.host, state.connection.accessCode, serial);

        state.status = result.ok ? "online" : "error";
        state.lastSeen = new Date().toISOString();
        writeState(state);

        return NextResponse.json({
          ok: result.ok,
          message: result.ok
            ? `MQTT connected to ${body.host}:8883 — live data streaming`
            : `Configuration saved. MQTT error: ${result.error}. Updates via polling.`,
          printer: state,
          mqtt: { connected: result.ok, error: result.error },
        });
      }

      case "disconnect": {
        if (mqttClient) {
          try { mqttClient.end(true); } catch { /* swallow */ }
          mqttClient = null;
        }
        state.status = "offline";
        state.connection.configured = false;
        state.connection.host = "";
        state.connection.accessCode = "";
        state.currentJob = null;
        state.temperatures = {
          nozzle: { current: 0, target: 0 },
          bed: { current: 0, target: 0 },
        };
        writeState(state);
        return NextResponse.json({ ok: true, message: "Printer disconnected, MQTT closed", printer: state });
      }

      case "update-status": {
        if (body.status) state.status = body.status;
        if (body.temperatures) state.temperatures = body.temperatures;
        if (body.filament) state.filament = { ...state.filament, ...body.filament };
        if (body.currentJob !== undefined) state.currentJob = body.currentJob;
        state.lastSeen = new Date().toISOString();
        writeState(state);
        return NextResponse.json({ ok: true, printer: state });
      }

      case "add-job": {
        state.currentJob = body.job;
        state.status = "printing";
        state.lastSeen = new Date().toISOString();
        writeState(state);
        return NextResponse.json({ ok: true, printer: state });
      }

      case "complete-job": {
        if (state.currentJob) {
          state.recentJobs.unshift({
            name: state.currentJob.name,
            status: body.status,
            duration: body.duration,
            completedAt: new Date().toISOString(),
            material: state.filament.type,
          });
          if (state.recentJobs.length > 20) state.recentJobs = state.recentJobs.slice(0, 20);
          state.stats.totalPrints += 1;
          const prevOk = Math.round((state.stats.successRate / 100) * (state.stats.totalPrints - 1));
          if (body.status === "completed") {
            state.stats.successRate = Math.round(((prevOk + 1) / state.stats.totalPrints) * 100);
          } else {
            state.stats.successRate = Math.round((prevOk / state.stats.totalPrints) * 100);
          }
          state.currentJob = null;
        }
        state.status = "idle";
        state.lastSeen = new Date().toISOString();
        writeState(state);
        return NextResponse.json({ ok: true, printer: state });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${(body as { action: string }).action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
