import { describe, it, expect } from "vitest";
import {
  coerceJobs,
  flattenScheduleFromJob,
  jobsPayloadShapeOk,
  normalizeCronJobEntry,
  parseCronSchedule,
} from "./calendar-cron";

describe("calendar-cron parseCronSchedule", () => {
  it("parses cron expr with daily * dow", () => {
    const r = parseCronSchedule("0 7 * * *");
    expect(r.time).toBe("07:00");
    expect(r.frequency).toBe("Daily");
    expect(r.days).toHaveLength(7);
  });

  it("parses cron expr with specific weekdays", () => {
    const r = parseCronSchedule("15 14 * * 1,3,5");
    expect(r.time).toBe("14:15");
    expect(r.days).toEqual(["Mon", "Wed", "Fri"]);
  });

  it("parses at-style daily", () => {
    const r = parseCronSchedule("at 6:30 daily");
    expect(r.time).toBe("06:30");
    expect(r.frequency).toBe("Daily");
  });

  it("returns Unknown for empty schedule", () => {
    expect(parseCronSchedule("").frequency).toBe("Unknown");
  });

  it("falls back to raw schedule string when unparseable", () => {
    const r = parseCronSchedule("every 5m");
    expect(r.frequency).toBe("every 5m");
  });
});

describe("flattenScheduleFromJob", () => {
  it("returns string schedule as-is", () => {
    expect(flattenScheduleFromJob({ schedule: "0 7 * * *" })).toBe("0 7 * * *");
  });

  it("reads expr from nested schedule object", () => {
    expect(flattenScheduleFromJob({ schedule: { expr: "0 9 * * 1-5" } })).toBe("0 9 * * 1-5");
  });

  it("reads cron alias", () => {
    expect(flattenScheduleFromJob({ schedule: { cron: "30 6 * * *" } })).toBe("30 6 * * *");
  });

  it("converts everyMs to every Nm", () => {
    expect(flattenScheduleFromJob({ schedule: { everyMs: 900_000 } })).toBe("every 15m");
  });

  it("combines with parseCronSchedule for expr jobs", () => {
    const s = flattenScheduleFromJob({ schedule: { expr: "0 7 * * *" } });
    expect(parseCronSchedule(s).time).toBe("07:00");
  });
});

describe("jobsPayloadShapeOk", () => {
  it("accepts top-level array", () => {
    expect(jobsPayloadShapeOk([])).toBe(true);
    expect(jobsPayloadShapeOk([{ id: "a" }])).toBe(true);
  });

  it("accepts { jobs: array }", () => {
    expect(jobsPayloadShapeOk({ jobs: [] })).toBe(true);
  });

  it("rejects invalid shapes", () => {
    expect(jobsPayloadShapeOk({})).toBe(false);
    expect(jobsPayloadShapeOk({ jobs: "nope" })).toBe(false);
    expect(jobsPayloadShapeOk(null)).toBe(false);
  });
});

describe("normalizeCronJobEntry & coerceJobs", () => {
  it("normalizeCronJobEntry returns {} for non-object", () => {
    expect(normalizeCronJobEntry(null)).toEqual({});
    expect(normalizeCronJobEntry("x")).toEqual({});
  });

  it("prefers agentId and flattens nested schedule", () => {
    const j = normalizeCronJobEntry({
      id: "c1",
      name: "Morning",
      agentId: "atlas",
      schedule: { expr: "0 8 * * *" },
    });
    expect(j.agent).toBe("atlas");
    expect(j.schedule).toBe("0 8 * * *");
    expect(j.name).toBe("Morning");
  });

  it("coerceJobs handles array and { jobs } wrapper", () => {
    const a = coerceJobs([{ name: "A", schedule: "0 1 * * *" }]);
    expect(a).toHaveLength(1);
    expect(a[0]?.schedule).toBe("0 1 * * *");

    const b = coerceJobs({ jobs: [{ name: "B", schedule: { expr: "0 2 * * *" } }] });
    expect(b).toHaveLength(1);
    expect(b[0]?.schedule).toBe("0 2 * * *");
  });

  it("coerceJobs yields empty array for empty object", () => {
    expect(coerceJobs({})).toEqual([]);
  });
});
