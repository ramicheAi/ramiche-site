"use client";

import { useState } from "react";
import type { AchievementToast } from "../coach/components/AchievementToasts";
import type { RecapData } from "../coach/components/PracticeRecapModal";
import type { Invite, InviteRole } from "../invites";
import type {
  Athlete,
  AuditEntry,
  TeamChallenge,
  DailySnapshot,
  TeamCulture,
  SwimMeet,
} from "../coach/types";

// ── types duplicated from page.tsx (local to coach module) ──

type GroupId = "platinum" | "gold" | "silver" | "bronze1" | "bronze2" | "diving" | "waterpolo";

type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

interface GroupSchedule {
  groupId: string;
  weekSchedule: Record<DayOfWeek, { template: string; sessions: { id: string; type: string; label: string; startTime: string; endTime: string; location: string; notes: string }[] }>;
}

interface CoachProfile {
  id: string;
  name: string;
  role: "head" | "assistant";
  groups: GroupId[];
  email: string;
  pin: string;
}

interface SessionRecord {
  id: string;
  date: string;
  group: string;
  startTime: string;
  endTime: string;
  sessionType: "am" | "pm";
  attendance: { id: string; name: string; present: boolean; checkpoints: Record<string, boolean>; weightCheckpoints: Record<string, boolean> }[];
  totalPresent: number;
  totalAthletes: number;
  locked: boolean;
}

interface XpFloat {
  id: number;
  x: number;
  y: number;
  amount: number;
}

const DEFAULT_CULTURE: TeamCulture = {
  teamName: "Saint Andrew's Aquatics",
  mission: "Excellence Through Consistency",
  seasonalGoal: "90% attendance this month",
  goalTarget: 90, goalCurrent: 0,
  weeklyQuote: "Champions do extra. — Unknown",
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function useCoachUI() {
  // ── auth / pin ──
  const [coachPin, setCoachPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  // ── roster data ──
  const [roster, setRoster] = useState<Athlete[]>([]);

  // ── selection ──
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [parentPreviewAthlete, setParentPreviewAthlete] = useState<string | null>(null);

  // ── session mode (pool / weight / meet) ──
  const [sessionMode, setSessionModeRaw] = useState<"pool" | "weight" | "meet">("pool");
  const [pendingMode, setPendingMode] = useState<"pool" | "weight" | "meet" | null>(null);

  // ── AM / PM toggle ──
  const [sessionTime, setSessionTime] = useState<"am" | "pm">(() => {
    if (typeof window === "undefined") return "am";
    const realTime = new Date().getHours() < 12 ? "am" : "pm";
    const manualDate = sessionStorage.getItem("apex_session_time_manual");
    if (manualDate === today()) {
      const saved = sessionStorage.getItem("apex_session_time_value");
      if (saved === "am" || saved === "pm") return saved;
    }
    if (manualDate && manualDate !== today()) {
      sessionStorage.removeItem("apex_session_time_manual");
      sessionStorage.removeItem("apex_session_time_value");
    }
    localStorage.removeItem("apex_session_time_manual");
    localStorage.removeItem("apex_session_time_value");
    return realTime;
  });
  const [pendingAmPm, setPendingAmPm] = useState(false);

  // ── tabs & views ──
  const [leaderTab, setLeaderTab] = useState<"all" | "M" | "F">("all");
  const [view, setView] = useState<"coach" | "parent" | "audit" | "analytics" | "schedule" | "wellness" | "staff" | "meets" | "comms">("coach");

  // ── audit & challenges ──
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [teamChallenges, setTeamChallenges] = useState<TeamChallenge[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);

  // ── culture ──
  const [culture, setCulture] = useState<TeamCulture>(DEFAULT_CULTURE);
  const [editingCulture, setEditingCulture] = useState(false);

  // ── analytics selections ──
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [timelineAthleteId, setTimelineAthleteId] = useState<string | null>(null);
  const [comparePeriod, setComparePeriod] = useState<"week" | "month">("week");

  // ── add athlete form ──
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newAthleteAge, setNewAthleteAge] = useState("");
  const [newAthleteGender, setNewAthleteGender] = useState<"M" | "F">("M");

  // ── group selection ──
  const [selectedGroup, setSelectedGroup] = useState<GroupId>("platinum");

  // ── lifecycle ──
  const [mounted, setMounted] = useState(false);

  // ── level-up overlay ──
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState("");
  const [levelUpIcon, setLevelUpIcon] = useState("");
  const [levelUpColor, setLevelUpColor] = useState("");
  const [levelUpExiting, setLevelUpExiting] = useState(false);

  // ── XP floats & achievement toasts ──
  const [xpFloats, setXpFloats] = useState<XpFloat[]>([]);
  const [achieveToasts, setAchieveToasts] = useState<AchievementToast[]>([]);

  // ── combo counter ──
  const [comboCount, setComboCount] = useState(0);
  const [comboExiting, setComboExiting] = useState(false);

  // ── bulk undo ──
  const [bulkUndoVisible, setBulkUndoVisible] = useState(false);
  const [bulkUndoSnapshot, setBulkUndoSnapshot] = useState<Athlete[] | null>(null);

  // ── more menu & confirm dialog ──
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);

  // ── practice recap ──
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<RecapData | null>(null);

  // ── invite system ──
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteList, setInviteList] = useState<Invite[]>([]);
  const [newInviteRole, setNewInviteRole] = useState<InviteRole>("athlete");
  const [newInviteLabel, setNewInviteLabel] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // ── schedule state ──
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [scheduleGroup, setScheduleGroup] = useState<GroupId>("platinum");
  const [editingSession, setEditingSession] = useState<{ day: DayOfWeek; sessionIdx: number } | null>(null);
  const [scheduleEditMode, setScheduleEditMode] = useState(false);

  // ── coach management ──
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [addCoachOpen, setAddCoachOpen] = useState(false);
  const [newCoachName, setNewCoachName] = useState("");
  const [newCoachRole, setNewCoachRole] = useState<"head" | "assistant">("assistant");
  const [newCoachGroups, setNewCoachGroups] = useState<GroupId[]>([]);
  const [newCoachEmail, setNewCoachEmail] = useState("");
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);

  // ── meets & comms ──
  const [meets, setMeets] = useState<SwimMeet[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [newMeetName, setNewMeetName] = useState("");
  const [newMeetDate, setNewMeetDate] = useState("");
  const [newMeetLocation, setNewMeetLocation] = useState("");
  const [newMeetCourse, setNewMeetCourse] = useState<"SCY" | "SCM" | "LCM">("SCY");
  const [newMeetDeadline, setNewMeetDeadline] = useState("");
  const [editingMeetId, setEditingMeetId] = useState<string | null>(null);
  const [meetEventPicker, setMeetEventPicker] = useState<string | null>(null);

  // ── comms ──
  const [allBroadcasts, setAllBroadcasts] = useState<{ id: string; message: string; timestamp: string; from: string; group: string }[]>([]);
  const [commsMsg, setCommsMsg] = useState("");
  const [commsGroup, setCommsGroup] = useState<"all" | GroupId>("all");
  const [absenceReports, setAbsenceReports] = useState<{ id: string; athleteId: string; athleteName: string; reason: string; dateStart: string; dateEnd: string; note: string; submitted: string; group: string }[]>([]);

  // ── push notifications ──
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // ── session history ──
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [editingHistorySession, setEditingHistorySession] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  return {
    // auth / pin
    coachPin, setCoachPin,
    pinInput, setPinInput,
    unlocked, setUnlocked,

    // roster
    roster, setRoster,

    // selection
    selectedAthlete, setSelectedAthlete,
    parentPreviewAthlete, setParentPreviewAthlete,

    // session mode
    sessionMode, setSessionModeRaw,
    pendingMode, setPendingMode,

    // AM / PM
    sessionTime, setSessionTime,
    pendingAmPm, setPendingAmPm,

    // tabs & views
    leaderTab, setLeaderTab,
    view, setView,

    // audit & challenges
    auditLog, setAuditLog,
    teamChallenges, setTeamChallenges,
    snapshots, setSnapshots,

    // culture
    culture, setCulture,
    editingCulture, setEditingCulture,

    // analytics selections
    selectedDay, setSelectedDay,
    timelineAthleteId, setTimelineAthleteId,
    comparePeriod, setComparePeriod,

    // add athlete form
    addAthleteOpen, setAddAthleteOpen,
    newAthleteName, setNewAthleteName,
    newAthleteAge, setNewAthleteAge,
    newAthleteGender, setNewAthleteGender,

    // group
    selectedGroup, setSelectedGroup,

    // lifecycle
    mounted, setMounted,

    // level-up overlay
    levelUpName, setLevelUpName,
    levelUpLevel, setLevelUpLevel,
    levelUpIcon, setLevelUpIcon,
    levelUpColor, setLevelUpColor,
    levelUpExiting, setLevelUpExiting,

    // XP floats & toasts
    xpFloats, setXpFloats,
    achieveToasts, setAchieveToasts,

    // combo counter
    comboCount, setComboCount,
    comboExiting, setComboExiting,

    // bulk undo
    bulkUndoVisible, setBulkUndoVisible,
    bulkUndoSnapshot, setBulkUndoSnapshot,

    // more menu & confirm
    showMoreMenu, setShowMoreMenu,
    confirmAction, setConfirmAction,

    // practice recap
    showRecap, setShowRecap,
    recapData, setRecapData,

    // invite system
    showInviteModal, setShowInviteModal,
    inviteList, setInviteList,
    newInviteRole, setNewInviteRole,
    newInviteLabel, setNewInviteLabel,
    copiedToken, setCopiedToken,

    // schedule
    schedules, setSchedules,
    scheduleGroup, setScheduleGroup,
    editingSession, setEditingSession,
    scheduleEditMode, setScheduleEditMode,

    // coach management
    coaches, setCoaches,
    addCoachOpen, setAddCoachOpen,
    newCoachName, setNewCoachName,
    newCoachRole, setNewCoachRole,
    newCoachGroups, setNewCoachGroups,
    newCoachEmail, setNewCoachEmail,
    editingCoachId, setEditingCoachId,

    // meets
    meets, setMeets,
    broadcastMsg, setBroadcastMsg,
    newMeetName, setNewMeetName,
    newMeetDate, setNewMeetDate,
    newMeetLocation, setNewMeetLocation,
    newMeetCourse, setNewMeetCourse,
    newMeetDeadline, setNewMeetDeadline,
    editingMeetId, setEditingMeetId,
    meetEventPicker, setMeetEventPicker,

    // comms
    allBroadcasts, setAllBroadcasts,
    commsMsg, setCommsMsg,
    commsGroup, setCommsGroup,
    absenceReports, setAbsenceReports,

    // push notifications
    pushEnabled, setPushEnabled,
    pushLoading, setPushLoading,

    // session history
    sessionHistory, setSessionHistory,
    showSessionHistory, setShowSessionHistory,
    editingHistorySession, setEditingHistorySession,
    confirmDeleteSessionId, setConfirmDeleteSessionId,
    confirmClearAll, setConfirmClearAll,
  };
}

export type CoachUIState = ReturnType<typeof useCoachUI>;
