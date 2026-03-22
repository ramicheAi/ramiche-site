/**
 * HY3/HYV/EV3/SD3/CL2 Meet File Parser
 * Restored from commit 66e6c4f^ — originally in /apex-athlete/page.tsx lines 4270-4730
 */

import type { SwimMeet, MeetEvent, MeetSession } from "../coach/types";

const CURRENT_PARSER_VERSION = 4;

const parseTimeToSecs = (t: string): number => {
  if (!t) return 0;
  const clean = t.replace(/[^0-9:.]/g, "").trim();
  const parts = clean.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(clean) || 0;
};

const isValidTime = (t: string) =>
  /^\d{1,3}:\d{2}\.\d{2}$/.test(t) || /^\d{1,2}\.\d{2}$/.test(t);

const findHy3Time = (row: string[], indices: number[]) => {
  for (const i of indices) {
    const v = (row[i] || "").trim();
    if (isValidTime(v)) return v;
  }
  return "";
};

const strokeMap: Record<string, string> = { A: "Free", B: "Back", C: "Breast", D: "Fly", E: "IM" };
const strokeMapNum: Record<string, string> = { "1": "Free", "2": "Back", "3": "Breast", "4": "Fly", "5": "IM", "6": "Free Relay", "7": "Medley Relay" };

export function parseMeetFile(text: string, filename: string): Partial<SwimMeet> | null {
  let normalizedText = text;
  if (normalizedText.charCodeAt(0) === 0xFEFF) normalizedText = normalizedText.slice(1);
  const rawLines = normalizedText.split(/\r?\n/).filter(l => l.trim().length > 2);
  if (rawLines.length < 3 && normalizedText.includes("*>")) {
    normalizedText = normalizedText.replace(/\*>/g, "\n");
  }
  const lines = normalizedText.split(/\r?\n/)
    .map(l => l.replace(/\*>\s*$/, "").replace(/\*>$/, "").trim())
    .filter(l => l.length > 2);
  if (lines.length < 2) return null;

  let ext = filename.toLowerCase().split(".").pop() || "";
  if (!["hy3", "hyv", "cl2", "sd3", "ev3"].includes(ext)) {
    const firstLine = lines[0];
    if (firstLine.includes(";")) {
      let ev3Score = 0;
      let hy3Score = 0;
      const headerFields = firstLine.split(";");
      const field1 = (headerFields[1] || "").trim();
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(field1)) ev3Score += 3;
      else hy3Score += 1;
      const eventLine = lines[1] || "";
      const semiCount = (eventLine.match(/;/g) || []).length;
      if (semiCount > 20) hy3Score += 2;
      else if (semiCount <= 20 && semiCount >= 8) ev3Score += 1;
      const evFields = eventLine.split(";");
      const f1 = (evFields[1] || "").trim().toUpperCase();
      if (f1 === "P" || f1 === "F") {
        if (!/^\d+$/.test(f1)) ev3Score += 3;
      } else if (/^\d+$/.test(f1)) {
        hy3Score += 2;
      }
      const f9 = (evFields[9] || "").trim().toUpperCase();
      if (/^[A-E]$/.test(f9)) hy3Score += 2;
      const f7ev3 = (evFields[7] || "").trim();
      if (/^[1-7]$/.test(f7ev3) && (f1 === "P" || f1 === "F")) ev3Score += 2;
      const f2 = (evFields[2] || "").trim().toUpperCase();
      const f5 = (evFields[5] || "").trim().toUpperCase();
      if ((f2 === "F" || f2 === "M") && (f1 === "P" || f1 === "F")) ev3Score += 2;
      if (f5 === "W" || f5 === "M") hy3Score += 1;
      ext = ev3Score > hy3Score ? "ev3" : "hy3";
    } else if (lines[0].substring(0, 2) === "B1" || lines[0].substring(0, 2) === "01") {
      ext = "sd3";
    } else {
      return null;
    }
  }

  let meetName = ""; let meetDate = ""; let meetEndDate = ""; let facility = "";
  let course: "SCY" | "SCM" | "LCM" = "SCY";
  const events: MeetEvent[] = [];
  const sessions: MeetSession[] = [];

  const parseDate = (d: string) => {
    const p = (d || "").trim().split("/");
    return p.length === 3 && p[0].length >= 1 ? `${p[2]}-${p[0].padStart(2, "0")}-${p[1].padStart(2, "0")}` : "";
  };

  const isSemicolon = lines[0]?.includes(";");

  if (isSemicolon) {
    const header = lines[0].split(";");
    meetName = (header[0] || "").trim();

    if (ext === "ev3") {
      meetDate = parseDate(header[1] || "");
      meetEndDate = parseDate(header[2] || "");
      facility = (header[5] || "").trim();
      const courseField = (header[4] || "").toUpperCase();
      if (courseField.includes("Y")) course = "SCY";
      else if (courseField.includes("L")) course = "LCM";
      else if (courseField.includes("S")) course = "SCM";
    } else {
      facility = (header[1] || "").trim();
      meetDate = parseDate(header[2] || "");
      meetEndDate = parseDate(header[3] || "");
      const courseField = (header[5] || "").toUpperCase();
      if (courseField.includes("Y") || courseField === "YLS") course = "SCY";
      else if (courseField.includes("L")) course = "LCM";
      else if (courseField.includes("S")) course = "SCM";
    }

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(";");
      if (row.length < 7) continue;
      const evNum = parseInt(row[0]) || i;

      let dist = ""; let strokeName = ""; let gender: "M" | "F" | "Mixed" = "Mixed";
      let sessionType = ""; let qualTime = ""; let cutTimeVal = ""; let dayNum: number | undefined;
      let isRelay = false;

      if (ext === "ev3") {
        dist = (row[6] || "").trim();
        const strokeNum = (row[7] || "1").trim();
        const genderCode = (row[2] || "").toUpperCase().trim();
        sessionType = (row[1] || "").toUpperCase().trim();
        isRelay = (row[3] || "").toUpperCase().trim() === "R";
        strokeName = isRelay
          ? (strokeNum === "1" || strokeNum === "6" ? "Free Relay" : "Medley Relay")
          : (strokeMapNum[strokeNum] || "Free");
        gender = genderCode === "M" ? "M" : genderCode === "F" ? "F" : "Mixed";
        const rawQT = (row[9] || "").trim();
        const rawCut = (row[13] || "").trim();
        const ev3TimeA = isValidTime(rawQT) ? rawQT : "";
        const ev3TimeB = isValidTime(rawCut) ? rawCut : "";
        if (ev3TimeA && ev3TimeB && ev3TimeA !== ev3TimeB) {
          const secsA = parseTimeToSecs(ev3TimeA);
          const secsB = parseTimeToSecs(ev3TimeB);
          qualTime = secsA < secsB ? ev3TimeA : ev3TimeB;
          cutTimeVal = secsA < secsB ? ev3TimeB : ev3TimeA;
        } else {
          qualTime = ev3TimeA || ev3TimeB;
          cutTimeVal = "";
        }
      } else {
        dist = (row[8] || "").trim();
        const strokeCode = (row[9] || "A").trim().toUpperCase();
        const genderCode = (row[5] || "").toUpperCase().trim();
        sessionType = (row[2] || "").toUpperCase().trim();
        isRelay = (row[4] || "").toUpperCase().trim() === "R";
        strokeName = isRelay
          ? (strokeCode === "A" ? "Free Relay" : "Medley Relay")
          : (strokeMap[strokeCode] || "Free");
        gender = genderCode === "M" ? "M" : (genderCode === "W" || genderCode === "F") ? "F" : "Mixed";
        const timeA = findHy3Time(row, [16, 15, 17]);
        const timeB = findHy3Time(row, [20, 21, 19]);
        if (timeA && timeB && timeA !== timeB) {
          const secsA = parseTimeToSecs(timeA);
          const secsB = parseTimeToSecs(timeB);
          qualTime = secsA < secsB ? timeA : timeB;
          cutTimeVal = secsA < secsB ? timeB : timeA;
        } else {
          qualTime = timeA || timeB;
          cutTimeVal = "";
        }
        dayNum = parseInt(row[23] || "") || undefined;
      }

      const genderLabel = gender === "F" ? "Girls" : gender === "M" ? "Boys" : "";
      const sessionLabel = sessionType === "P" ? "Prelims" : sessionType === "F" ? "Finals" : "";
      const distStr = dist && dist !== "0" ? `${dist} ` : "";
      const name = `${genderLabel ? genderLabel + " " : ""}${distStr}${strokeName}${sessionLabel ? " (" + sessionLabel + ")" : ""}`.trim();
      events.push({
        id: `ev-import-${evNum}`,
        name: name || `Event ${evNum}`,
        eventNum: evNum,
        gender,
        distance: parseInt(dist) || undefined,
        stroke: strokeName,
        sessionType: (sessionType === "P" || sessionType === "F") ? sessionType as "P" | "F" : undefined,
        isRelay,
        qualifyingTime: qualTime || cutTimeVal || undefined,
        cutTime: cutTimeVal && qualTime && cutTimeVal !== qualTime ? cutTimeVal : undefined,
        dayNumber: dayNum,
        entries: [],
      });
    }
  } else {
    let eventNum = 0;
    const isSD3 = ext === "sd3";
    for (const line of lines) {
      const recType = line.substring(0, 2);
      if (recType === "B1" || recType === "01") {
        meetName = (isSD3 ? line.substring(11, 56) : line.substring(2, 47)).trim();
        facility = (isSD3 ? line.substring(56, 101) : line.substring(47, 92)).trim();
        const dateStr = (isSD3 ? line.substring(101, 109) : line.substring(92, 100)).trim();
        if (dateStr.length === 8) meetDate = `${dateStr.slice(4, 8)}-${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}`;
        const endStr = (isSD3 ? line.substring(109, 117) : line.substring(100, 108)).trim();
        if (endStr.length === 8) meetEndDate = `${endStr.slice(4, 8)}-${endStr.slice(0, 2)}-${endStr.slice(2, 4)}`;
        const courseCode = (isSD3 ? line.charAt(117) : line.charAt(108)).toUpperCase();
        course = courseCode === "L" ? "LCM" : courseCode === "X" || courseCode === "M" ? "SCM" : "SCY";
      }
      if (recType === "E0" || recType === "D3" || recType === "04") {
        eventNum++;
        const eventDesc = (isSD3 ? line.substring(11, 36) : line.substring(2, 32)).trim();
        let name = eventDesc;
        if (!name || name.length < 3) {
          const d = line.substring(isSD3 ? 36 : 32, isSD3 ? 40 : 36).trim();
          const sc = line.charAt(isSD3 ? 40 : 36);
          name = `${d} ${strokeMapNum[sc] || "Free"}`;
        }
        const genderCode = line.charAt(isSD3 ? 41 : 37);
        const gdr: "M" | "F" | "Mixed" = genderCode === "M" ? "M" : genderCode === "F" ? "F" : "Mixed";
        if (name.length > 2) events.push({ id: `ev-import-${eventNum}`, name, eventNum, gender: gdr, entries: [] });
      }
    }
  }

  if (!meetName && events.length === 0) return null;

  // Validate — if all events look broken, retry with opposite format
  if (isSemicolon && events.length > 3) {
    const allMixed = events.every(e => e.gender === "Mixed");
    const allFree = events.filter(e => e.stroke === "Free" || !e.stroke).length > events.length * 0.8;
    const noDistances = events.every(e => !e.distance || e.distance === 0);
    if ((allMixed && noDistances) || (allMixed && allFree)) {
      const retryExt = ext === "ev3" ? "hy3" : "ev3";
      const retryEvents: MeetEvent[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(";");
        if (row.length < 7) continue;
        const evNum = parseInt(row[0]) || i;
        let rDist = ""; let rStroke = ""; let rGender: "M" | "F" | "Mixed" = "Mixed";
        let rSession = ""; let rRelay = false; let rQT = ""; let rCut = ""; let rDay: number | undefined;
        if (retryExt === "ev3") {
          rDist = (row[6] || "").trim();
          const sn = (row[7] || "1").trim();
          const gc = (row[2] || "").toUpperCase().trim();
          rSession = (row[1] || "").toUpperCase().trim();
          rRelay = (row[3] || "").toUpperCase().trim() === "R";
          rStroke = rRelay ? (sn === "1" || sn === "6" ? "Free Relay" : "Medley Relay") : (strokeMapNum[sn] || "Free");
          rGender = gc === "M" ? "M" : gc === "F" ? "F" : "Mixed";
          rQT = (row[9] || "").trim();
        } else {
          rDist = (row[8] || "").trim();
          const sc = (row[9] || "A").trim().toUpperCase();
          const gc = (row[5] || "").toUpperCase().trim();
          rSession = (row[2] || "").toUpperCase().trim();
          rRelay = (row[4] || "").toUpperCase().trim() === "R";
          rStroke = rRelay ? (sc === "A" ? "Free Relay" : "Medley Relay") : (strokeMap[sc] || "Free");
          rGender = gc === "M" ? "M" : (gc === "W" || gc === "F") ? "F" : "Mixed";
          rQT = (row[20] || "").trim();
          rCut = (row[15] || "").trim() || (row[16] || "").trim();
          rDay = parseInt(row[23] || "") || undefined;
        }
        const rGL = rGender === "F" ? "Girls" : rGender === "M" ? "Boys" : "";
        const rSL = rSession === "P" ? "Prelims" : rSession === "F" ? "Finals" : "";
        const rDS = rDist && rDist !== "0" ? `${rDist} ` : "";
        const rName = `${rGL ? rGL + " " : ""}${rDS}${rStroke}${rSL ? " (" + rSL + ")" : ""}`.trim();
        retryEvents.push({
          id: `ev-import-${evNum}`, name: rName || `Event ${evNum}`, eventNum: evNum, gender: rGender,
          distance: parseInt(rDist) || undefined, stroke: rStroke,
          sessionType: (rSession === "P" || rSession === "F") ? rSession as "P" | "F" : undefined,
          isRelay: rRelay, qualifyingTime: rQT || rCut || undefined,
          cutTime: rCut && rQT && rCut !== rQT ? rCut : undefined, dayNumber: rDay, entries: [],
        });
      }
      const retryAllMixed = retryEvents.every(e => e.gender === "Mixed");
      const retryNoDist = retryEvents.every(e => !e.distance || e.distance === 0);
      if (!retryAllMixed || !retryNoDist) {
        return {
          name: meetName || filename.replace(/\.(hy3|hyv|cl2|sd3|ev3)$/i, ""),
          date: meetDate || new Date().toISOString().slice(0, 10),
          endDate: meetEndDate || undefined,
          location: facility, course, events: retryEvents, sessions,
        };
      }
    }
  }

  return {
    name: meetName || filename.replace(/\.(hy3|hyv|cl2|sd3|ev3)$/i, ""),
    date: meetDate || new Date().toISOString().slice(0, 10),
    endDate: meetEndDate || undefined,
    location: facility, course, events, sessions,
  };
}

export { CURRENT_PARSER_VERSION };
