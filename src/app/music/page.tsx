import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

type MusicData = {
  version: number;
  updatedAt: string;
  projects: Array<{
    id: string;
    name: string;
    owner: string;
    status: string;
    goal?: string;
    notes?: string;
    tracks?: Array<{
      id: string;
      title: string;
      stage: string;
      priority?: number;
      blockers?: string[];
      deliverables?: Record<string, boolean>;
    }>;
  }>;
};

function loadMusic(): MusicData {
  // local dev convenience: read from ramiche-ops repo in the workspace
  const p = "/Users/admin/.openclaw/workspace/repos/ramiche-ops/data/music.json";
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

export default function MusicPage() {
  const data = loadMusic();

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 20px 64px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
            Automation Dock
          </div>
          <h1 style={{ fontSize: 30, margin: "8px 0 6px" }}>Music Command Center</h1>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            System-of-record: <code>ramiche-ops/data/music.json</code>
          </div>
        </div>
        <div style={{ textAlign: "right", opacity: 0.7, fontSize: 12 }}>
          Updated: {new Date(data.updatedAt).toLocaleString()}
          <div>
            <Link href="/" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
              ← GA Command Center
            </Link>
          </div>
        </div>
      </header>

      <section
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          padding: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, letterSpacing: "0.02em" }}>Projects</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
          {data.projects.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Owner: {p.owner}</div>
                </div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    {p.status}
                  </span>
                </div>
              </div>

              {p.goal ? <div style={{ marginTop: 10, opacity: 0.85 }}>{p.goal}</div> : null}
              {p.notes ? <div style={{ marginTop: 8, opacity: 0.7 }}>{p.notes}</div> : null}

              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
                Tracks: {p.tracks?.length ?? 0} (add tracks in <code>music.json</code>)
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 12 }}>
        Next: add “stalled” detection (lastTouchedAt), blockers, and a weekly momentum report PR.
      </footer>
    </main>
  );
}
