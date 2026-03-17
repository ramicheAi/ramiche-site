"use client";
import { useState } from "react";
import type { SwimMeet } from "../coach/types";

type GroupId = "platinum" | "gold" | "silver" | "bronze1" | "bronze2" | "diving" | "waterpolo";

export interface Broadcast {
  id: string;
  message: string;
  timestamp: string;
  from: string;
  group: string;
}

export interface AbsenceReport {
  id: string;
  athleteId: string;
  athleteName: string;
  reason: string;
  dateStart: string;
  dateEnd: string;
  note: string;
  submitted: string;
  group: string;
}

export function useMeets() {
  // ── meets state ──
  const [meets, setMeets] = useState<SwimMeet[]>([]);
  const [newMeetName, setNewMeetName] = useState("");
  const [newMeetDate, setNewMeetDate] = useState("");
  const [newMeetLocation, setNewMeetLocation] = useState("");
  const [newMeetCourse, setNewMeetCourse] = useState<"SCY" | "SCM" | "LCM">("SCY");
  const [newMeetDeadline, setNewMeetDeadline] = useState("");
  const [editingMeetId, setEditingMeetId] = useState<string | null>(null);
  const [meetEventPicker, setMeetEventPicker] = useState<string | null>(null);

  // ── broadcast / comms state ──
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [allBroadcasts, setAllBroadcasts] = useState<Broadcast[]>([]);
  const [commsMsg, setCommsMsg] = useState("");
  const [commsGroup, setCommsGroup] = useState<"all" | GroupId>("all");
  const [absenceReports, setAbsenceReports] = useState<AbsenceReport[]>([]);

  // ── push notification state ──
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  return {
    meets, setMeets,
    newMeetName, setNewMeetName,
    newMeetDate, setNewMeetDate,
    newMeetLocation, setNewMeetLocation,
    newMeetCourse, setNewMeetCourse,
    newMeetDeadline, setNewMeetDeadline,
    editingMeetId, setEditingMeetId,
    meetEventPicker, setMeetEventPicker,
    broadcastMsg, setBroadcastMsg,
    allBroadcasts, setAllBroadcasts,
    commsMsg, setCommsMsg,
    commsGroup, setCommsGroup,
    absenceReports, setAbsenceReports,
    pushEnabled, setPushEnabled,
    pushLoading, setPushLoading,
  };
}
