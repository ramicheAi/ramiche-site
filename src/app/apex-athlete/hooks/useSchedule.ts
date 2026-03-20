"use client";
import { useState } from "react";

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type SessionType = "pool" | "weight" | "dryland";

export interface ScheduleSession {
  id: string;
  type: SessionType;
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
}

interface DaySchedule {
  template: string;
  sessions: ScheduleSession[];
}

export interface GroupSchedule {
  groupId: string;
  weekSchedule: Record<DayOfWeek, DaySchedule>;
  weekOverrides?: Record<string, Record<DayOfWeek, DaySchedule>>;
}

export type GroupId =
  | "platinum"
  | "gold"
  | "silver"
  | "bronze1"
  | "bronze2"
  | "diving"
  | "waterpolo";

export function useSchedule() {
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [scheduleGroup, setScheduleGroup] = useState<GroupId>("platinum");
  const [editingSession, setEditingSession] = useState<{
    day: DayOfWeek;
    sessionIdx: number;
  } | null>(null);
  const [scheduleEditMode, setScheduleEditMode] = useState(false);

  return {
    schedules,
    setSchedules,
    scheduleGroup,
    setScheduleGroup,
    editingSession,
    setEditingSession,
    scheduleEditMode,
    setScheduleEditMode,
  };
}
