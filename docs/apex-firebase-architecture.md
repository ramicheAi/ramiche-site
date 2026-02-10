# Apex Athlete v2 - Cloud Architecture (Firebase)

**Status:** PROPOSED
**Author:** Proximon
**Date:** 2026-02-09

## 1. Executive Summary
This architecture transitions Apex Athlete from local-only state to a scalable, offline-first cloud infrastructure. It prioritizes strict tenant isolation (multi-team support), COPPA compliance via managed identities for minors, and minimizing egress costs while maximizing query performance for gamification.

## 2. Authentication Strategy
Hybrid approach to satisfy COPPA (no PII for minors) and robust security for adults.

### 2.1 User Roles
*   **Coach/Admin:** Full email/password or OAuth (Google).
*   **Parent:** Full email/password or OAuth. Links to `Athlete` IDs.
*   **Athlete (Managed):** No email. Authenticates via `Team Code` + `Access Code`.

### 2.2 The "Managed Account" Flow (COPPA)
Since athletes cannot be asked for email/phone:
1.  **Provisioning:** Coach creates roster entry. System generates a unique `access_key` (e.g., `SA-7B29`).
2.  **Login:** Athlete enters `access_key` on the specific "Student Login" portal.
3.  **Mechanism:**
    *   Client calls Cloud Function: `authWithAccessKey({ key })`.
    *   Function validates key against `roster`.
    *   Function checks if a phantom Firebase Auth User exists for this ID; if not, creates one.
    *   Function returns **Custom Auth Token**.
    *   Client calls `signInWithCustomToken(token)`.
4.  **Result:** To Firebase Security Rules, the athlete is a valid, authenticated user with a `uid`, just like a coach.

## 3. Database Schema (Firestore)
We use a **Root-Tenant** pattern. Data is siloed within a Team document to simplify security rules and prevent cross-team data leaks.

### 3.1 Top-Level Collections

#### `teams` (Collection)
The boundary of isolation.
*   `id`: `auto-id` (or slug, e.g., `saint-andrews`)
*   `name`: "Saint Andrew's Aquatics"
*   `ownerId`: `uid` of head coach
*   `settings`: `{ gamificationEnabled: true, seasonStart: Timestamp }`

### 3.2 Sub-Collections (Under `teams/{teamId}`)

#### `teams/{id}/athletes`
*   `uid`: Matches Auth UID (if linked).
*   `displayName`: "Alex P."
*   `accessKey`: "SA-7B29" (Indexed, kept private via rules)
*   `groupId`: `ref`
*   **Gamification State:**
    *   `xp`: `number` (Aggregate)
    *   `level`: `number`
    *   `streak`: `number`
    *   `coins`: `number`
    *   `loadout`: `{ avatarId: string, bannerId: string }`

#### `teams/{id}/groups`
*   `name`: "Gold Group", "Senior Elite"
*   `assignedCoachIds`: `[uid]`

#### `teams/{id}/workouts`
*   `date`: `Timestamp` (Daily at 00:00)
*   `groupId`: `ref`
*   `sets`: `Array<SwimSet>`
    *   `{ repeat: 4, distance: 100, interval: 90, stroke: 'Free' }`
*   `coachingNotes`: `string`

#### `teams/{id}/attendance`
*   `date`: `ISO-8601-Date` (YYYY-MM-DD)
*   `groupId`: `ref`
*   `presentAthleteIds`: `[uid]` (Array of IDs for efficient check-in)
    *   *Note:* Using an array here is cheaper for reads than 20 separate docs per day, provided the group size < 500.

#### `teams/{id}/activity_log` (The Gamification Engine)
Immutable event stream. Critical for audits and recalculating XP if rules change.
*   `athleteId`: `uid`
*   `type`: "attendance" | "gold_medal_time" | "level_up" | "purchase"
*   `deltaXP`: `number`
*   `metadata`: `{ workoutId: "...", details: "Beat PB" }`
*   `timestamp`: `ServerTimestamp`

## 4. Security Rules (Firestore)
Logic cascades from the `teamId`.

```javascript
match /teams/{teamId} {
  // Helper functions
  function isCoach() {
    return get(/databases/$(database)/documents/teams/$(teamId)/roles/$(request.auth.uid)).data.role == 'coach';
  }
  
  function isSelf(userId) {
    return request.auth.uid == userId;
  }

  // Athletes sub-collection
  match /athletes/{athleteId} {
    allow read: if isCoach() || isSelf(athleteId);
    // Athletes can only update their 'loadout' (skin/avatar), not their XP
    allow update: if isCoach() || (isSelf(athleteId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['loadout']));
  }
  
  // Workouts (Read-only for athletes)
  match /workouts/{workoutId} {
    allow read: if request.auth != null; // Any auth user in the team
    allow write: if isCoach();
  }
}
```

## 5. Offline & Sync Strategy
*   **Enabling:** `enableIndexedDbPersistence()` on the client.
*   **Conflict Resolution:**
    *   *Attendance:* Last-write-wins is acceptable for attendance status.
    *   *Gamification:* Do not write strictly to `athlete.xp`. Instead, write to `activity_log`. Cloud Functions (or client logic with strict rules) aggregates the log.
    *   *Optimization:* For immediate UI feedback, Client increments local XP optimisticly. Cloud Function `onCreate(activity_log)` validates and does the hard commit to `athlete.xp` (the source of truth).

## 6. Cost Analysis (Estimated - Starter Tier)
*   **Reads:**
    *   Coach loading roster (40 kids): 40 reads.
    *   Athlete loading dashboard: 1 read (profile) + 1 read (todays workout) + 5 reads (recent activity). ~10 reads/session.
*   **Writes:**
    *   Attendance: 1 write per group per day (batch array update).
    *   XP Gain: 1 write (log) + 1 write (profile update).
*   **Volume:** 240 athletes * 1 session/day * 30 days = ~7,200 sessions.
*   **Estimate:** Well within Firebase **Spark Plan (Free)** limits (50k reads/day, 20k writes/day).
    *   *Risk:* Leaderboards. If every kid reloads the leaderboard 10x a day, reads spike.
    *   *Mitigation:* Create a `leaderboard/daily_summary` document that aggregates top 10 positions, updated by Cloud Function every hour. Clients read that single doc instead of querying 240 athlete profiles.

## 7. Migration Path
1.  **Phase 1:** Auth Cloud Function implementation.
2.  **Phase 2:** Coach Portal - Roster Import from CSV (Current data).
3.  **Phase 3:** Parent/Athlete Portal - Read-only view of assigned group.
4.  **Phase 4:** Live Tracking - Coaches "Close" a practice -> Triggers XP distribution.
