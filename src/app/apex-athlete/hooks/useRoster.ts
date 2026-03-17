"use client";
import { useState, useRef } from "react";
import type { Athlete } from "../coach/types";
import type { GroupId } from "../coach/types";

export function useRoster() {
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [parentPreviewAthlete, setParentPreviewAthlete] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupId>("platinum");

  // add-athlete form
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newAthleteAge, setNewAthleteAge] = useState("");
  const [newAthleteGender, setNewAthleteGender] = useState<"M" | "F">("M");

  // bulk undo
  const [bulkUndoVisible, setBulkUndoVisible] = useState(false);
  const [bulkUndoSnapshot, setBulkUndoSnapshot] = useState<Athlete[] | null>(null);
  const bulkUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return {
    roster,
    setRoster,
    selectedAthlete,
    setSelectedAthlete,
    parentPreviewAthlete,
    setParentPreviewAthlete,
    selectedGroup,
    setSelectedGroup,
    addAthleteOpen,
    setAddAthleteOpen,
    newAthleteName,
    setNewAthleteName,
    newAthleteAge,
    setNewAthleteAge,
    newAthleteGender,
    setNewAthleteGender,
    bulkUndoVisible,
    setBulkUndoVisible,
    bulkUndoSnapshot,
    setBulkUndoSnapshot,
    bulkUndoTimer,
  };
}
