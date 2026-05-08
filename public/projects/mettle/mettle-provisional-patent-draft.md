# PROVISIONAL PATENT APPLICATION

## UNITED STATES PATENT AND TRADEMARK OFFICE

---

**Application Type:** Provisional Patent Application under 35 U.S.C. 111(b)

**Inventor:** Ramon Walton

**Assignee:** Parallax Ventures

**Filing Date:** February 18, 2026

---

## TITLE OF THE INVENTION

**Gamified Athlete Engagement and Management Platform with Intelligent Meet Qualification Filtering, Multi-Portal Architecture, and Automated Performance Data Integration**

(hereinafter referred to as "METTLE")

---

## CROSS-REFERENCE TO RELATED APPLICATIONS

This application is an original filing. No cross-reference to related applications exists. This provisional patent application establishes the priority date for the invention described herein.

---

## FIELD OF THE INVENTION

The present invention relates generally to computer-implemented systems and methods for athletic team management, and more specifically to a gamified engagement platform that combines experience-point-based motivational mechanics, intelligent competition meet management with automated qualification filtering, automated external performance data integration, multi-portal role-based access architecture, and a customer-relationship-management-style athlete management system, all delivered as a progressive web application with offline-first capability and cloud synchronization.

---

## BACKGROUND OF THE INVENTION

### The Problem of Athlete Disengagement

Youth and competitive athletics face a persistent and well-documented attrition problem. Across sports such as swimming, track and field, and gymnastics, athletes --- particularly those between the ages of 10 and 18 --- abandon their sport at alarming rates. While many factors contribute to this attrition, a primary and under-addressed cause is the failure of existing team management tools to foster sustained engagement, motivation, and a sense of progression.

### Deficiencies of Existing Systems

The current landscape of athletic team management software is dominated by platforms such as TeamUnify (now part of Stack Sports), OnDeck, and SwimOffice. These systems were designed primarily as administrative tools. Their core functionality centers on billing, roster management, meet entry generation, and parent communication. While competent at these administrative tasks, they share critical deficiencies:

**First**, existing platforms treat athletes as passive data subjects rather than active participants. Athletes have little to no direct interaction with these systems. There is no mechanism for athletes to track their own growth in a motivational context, set goals with real-time feedback, or participate in interactive challenges that reinforce training habits.

**Second**, existing platforms treat meet management as a purely clerical exercise. Coaches must manually cross-reference qualifying time standards against each athlete's personal best times, a tedious and error-prone process that can take hours for large teams entering multi-day competitions. No existing platform automates the filtering of eligible athletes based on qualification standards embedded within meet entry files.

**Third**, no existing platform combines gamification mechanics --- the application of game-design elements such as experience points, leveling systems, quests, streaks, and team challenges --- with athletic team management functionality. Gamification has been proven effective in domains such as fitness applications (e.g., Strava, Nike Run Club), education (e.g., Duolingo, Khan Academy), and corporate training, but it has not been systematically applied to competitive athletic team management in a way that is tightly integrated with real performance data.

**Fourth**, existing platforms do not integrate automated retrieval of verified competition times from national governing body databases. Coaches must manually look up and enter athlete best times, a process that introduces errors and quickly becomes outdated as athletes compete in new events.

**Fifth**, existing platforms lack a holistic athlete relationship management approach. Athlete wellness, journaling, weight room activity, attendance patterns, and motivational status are tracked --- if at all --- in disparate, disconnected systems.

### Unmet Need

There exists an unmet need for a unified platform that (a) actively engages athletes as participants through gamification tied to real training data; (b) automates intelligent meet management including qualification filtering; (c) integrates verified performance data from external authoritative databases; (d) provides role-appropriate portals for coaches, athletes, and parents within a single coherent data architecture; and (e) delivers athlete relationship management capabilities analogous to customer relationship management (CRM) systems used in business contexts.

---

## SUMMARY OF THE INVENTION

The present invention, designated METTLE, is a computer-implemented platform for gamified athlete engagement and intelligent team management. The system comprises the following principal innovations operating in concert:

1. A **three-portal architecture** providing role-specific interfaces for coaches, athletes, and parents, all operating on a shared persistent data layer with appropriate access controls.

2. A **gamification engine** that awards experience points (XP) based on verified real-world training activities, implements a multi-tier leveling system, provides a quest-and-approval workflow, supports team challenges with group bonuses, and applies streak-based multipliers to incentivize sustained participation.

3. An **intelligent meet management subsystem** capable of importing standardized competition meet files, automatically extracting qualifying standards, and cross-referencing those standards against athlete personal bests to produce filtered lists of eligible athletes with auto-populated seed times.

4. An **automated best times integration pipeline** that retrieves verified competition results from external national databases, supports multiple course-type conversions, and maintains current athlete performance records.

5. An **Athlete Relations Manager (ARM)** providing comprehensive athlete profiles, wellness tracking, performance analytics against standardized achievement levels, and goal-gap analysis.

6. A **practice session auto-reset mechanism** that detects new training sessions based on schedule data, snapshots prior session state, and initializes a fresh session context without manual coach intervention.

7. A **parent portal** designed with COPPA (Children's Online Privacy Protection Act) compliance considerations, providing read-only progress visibility and mediated communication.

8. A **multi-sport extensible architecture** in which sport-specific performance modules plug into a universal gamification and engagement layer.

---

## BRIEF DESCRIPTION OF THE DRAWINGS

The following figures, while not yet rendered as formal drawings, are referenced herein to illustrate the architecture and data flows of the invention. These conceptual figures form part of this disclosure:

**FIG. 1** --- System Architecture Overview. Illustrates the overall technical architecture of the METTLE platform, including the web application layer, the dual-persistence layer (client-side and cloud), server-side API routes, and external integrations with verified time databases, payment processing, and other third-party services.

**FIG. 2** --- Three-Portal Data Flow. Depicts the Coach Portal, Athlete Portal, and Parent Portal as three distinct presentation layers sharing a common data access layer, with arrows illustrating how data written by one portal becomes visible to the others according to role-based access rules.

**FIG. 3** --- Gamification Engine Architecture. Shows the XP calculation pipeline, illustrating how raw training events (attendance, check-ins, quest completions, time improvements) flow through the XP award module, the streak multiplier module, and the leveling module to produce updated athlete XP totals and level designations.

**FIG. 4** --- Meet Qualification Filter Flow. Illustrates the end-to-end process from meet file import through format auto-detection, event and standard extraction, athlete best-time cross-referencing, gender-aware filtering, and the production of a qualified-athlete roster with auto-populated seed times.

**FIG. 5** --- Best Times Integration Pipeline. Depicts the server-side integration flow from athlete identity resolution through external database query, time retrieval across multiple course types, cross-course conversion, and persistence to the athlete's canonical performance record.

---

## DETAILED DESCRIPTION OF PREFERRED EMBODIMENTS

The following description sets forth the preferred embodiments of the invention in sufficient detail to enable a person skilled in the art of software engineering and athletic team management to reproduce the system. It should be understood that these embodiments are illustrative and not limiting; various modifications and adaptations will be apparent to those skilled in the art.

### 1. Three-Portal Architecture

The METTLE platform is implemented as a unified web application presenting three distinct portals --- the Coach Portal, the Athlete Portal, and the Parent Portal --- each providing role-appropriate views and actions on a common underlying data layer.

**1.1 Coach Portal.** The Coach Portal serves as the primary administrative and operational interface. Through this portal, coaches can manage athlete rosters, organize athletes into training groups, create and assign quests (described in detail in Section 2.3), manage competition meet entries (described in Section 3), view attendance and check-in data, review athlete wellness journals, approve or deny quest submissions, configure gamification parameters, and access performance analytics. The Coach Portal provides both summary dashboard views and detailed drill-down capabilities for individual athletes.

**1.2 Athlete Portal.** The Athlete Portal serves as the athlete-facing engagement interface. Athletes access their personal XP totals, current level and progress toward the next level, active quests and their completion status, personal best times across all course types, badge collection, streak status, team challenge leaderboards, and goal-tracking dashboards. The Athlete Portal also provides wellness journaling functionality, allowing athletes to record daily check-ins regarding their mental and physical state, and weight room logging to track strength training activities. Critically, the Athlete Portal is designed as an active participation tool, not a passive information display; athletes interact with the system by checking in to practices, submitting quest completion evidence, logging workouts, and setting personal goals.

**1.3 Parent Portal.** The Parent Portal provides guardians with visibility into their child's athletic progress. In accordance with COPPA compliance requirements, the Parent Portal is designed as a primarily read-only interface. Parents can view their child's XP progression, badges earned, attendance history, growth trends over time, and upcoming competition schedules. The Parent Portal includes a mediated encouragement system (described in Section 7) and an absence reporting mechanism. Notably, the Parent Portal does not permit direct contact with minor athletes; all communication is mediated through the platform's structured messaging pathways and is visible to coaches.

**1.4 Shared Data Layer.** All three portals operate on a common persistent cloud data store. Role-based access control (RBAC) ensures that each portal can only read and write data appropriate to its role. For example, an athlete can read their own XP history but cannot modify it; a coach can write XP awards but a parent cannot; a parent can submit an absence report that becomes visible to the coach. The data schema is designed such that a single athlete document contains sub-collections for times, XP events, attendance records, quest submissions, journal entries, and weight room logs, providing a unified and comprehensive athlete record accessible to all authorized portals.

### 2. Gamification Engine for Athletic Training

The gamification engine is the central innovation driving athlete engagement. Unlike generic gamification overlays, the METTLE gamification engine is tightly coupled to real, verified training activities, ensuring that game-like incentives reinforce genuine athletic development.

**2.1 Experience Points (XP) System.** XP serves as the universal currency of achievement within the platform. XP is awarded for the following categories of activity:

- **Attendance XP:** Awarded when an athlete is marked present at a scheduled practice session. The base XP award for attendance is configurable by the coach (e.g., 10 XP per practice attended).
- **Check-in XP:** Awarded when an athlete actively checks in via the Athlete Portal at the start of a practice session, confirming physical presence and engagement. This is distinct from coach-marked attendance and rewards athlete initiative.
- **Quest Completion XP:** Awarded upon coach approval of a submitted quest (see Section 2.3). The XP value is set by the coach when creating the quest and may vary based on difficulty and importance.
- **Time Improvement XP:** Awarded automatically when an athlete's recorded time in any event improves relative to their personal best. The system detects the improvement upon entry of new competition results and awards XP proportional to the magnitude of improvement.
- **Team Challenge Bonus XP:** Awarded to all members of a team or group upon collective achievement of a team challenge goal (see Section 2.4).

All XP awards are logged as immutable events with timestamps, source activity references, and any applicable multipliers, creating a complete audit trail.

**2.2 Leveling System.** Accumulated XP drives progression through a six-tier leveling system:

| Level | Title | XP Threshold |
|-------|-------|-------------|
| 1 | Rookie | 0 XP |
| 2 | Contender | Configurable |
| 3 | Warrior | Configurable |
| 4 | Elite | Configurable |
| 5 | Captain | Configurable |
| 6 | Legend | Configurable |

XP thresholds for each level are configurable by the coach, allowing adaptation to team size, sport, and training intensity. When an athlete's cumulative XP crosses a level threshold, the system triggers a level-up event, which is surfaced as a notification in the Athlete Portal, displayed on the team leaderboard, and made visible to the athlete's parent(s) through the Parent Portal.

**2.3 Quest Engine.** The quest engine implements a structured mission-assignment-and-approval workflow:

- **Quest Creation:** A coach creates a quest by specifying a title, description, XP reward, deadline, and whether the quest is assigned to individual athletes, a specific group, or the entire team. Quests can represent any training-related objective, such as "Complete 5 extra practices this month," "Achieve a personal best in the 100 freestyle," or "Read an article about race strategy and write a summary."
- **Quest Assignment and Visibility:** Upon creation, the quest appears in the Athlete Portal of all assigned athletes, with a clear description, XP reward, and deadline.
- **Quest Submission:** When an athlete believes they have completed a quest, they submit proof of completion through the Athlete Portal. Proof may take the form of a text description, a photo upload, a time entry, or other evidence as appropriate to the quest type.
- **Coach Review and Approval:** The submission appears in the Coach Portal's review queue. The coach can approve or deny the submission, optionally providing feedback. Approval triggers the XP award; denial returns the quest to active status with coach feedback.
- **Quest Lifecycle Management:** Quests can have expiration dates after which they can no longer be submitted for. Coaches can revoke, modify, or extend quests as needed.

**2.4 Team Challenges.** Team challenges extend gamification to the collective level. A coach defines a team challenge with a collective XP goal (e.g., "As a team, earn 5,000 XP this week"). The system tracks aggregate XP earned by all team members toward the goal. Upon achievement, every participating member receives a group XP bonus. This mechanic incentivizes peer encouragement and collective accountability.

**2.5 Streak Tracking and Multipliers.** The system tracks consecutive-day engagement streaks for each athlete. An athlete's streak increments for each day in which they record at least one qualifying activity (attendance, check-in, quest submission, or workout log). The streak count applies an XP multiplier to all XP earned during the streak, according to the following schedule:

- **7-day streak:** 1.2x multiplier on all XP earned
- **30-day streak:** 1.5x multiplier on all XP earned
- **90-day streak:** 2.0x multiplier on all XP earned

Streak multipliers are applied at the time of XP award and are recorded in the XP event log. Breaking a streak (missing a day with no qualifying activity) resets the multiplier to 1.0x. The streak system creates a powerful retention mechanic, as athletes become increasingly reluctant to break longer streaks that carry higher multipliers.

### 3. Intelligent Meet Management with Automated Qualification Filtering

The meet management subsystem represents a significant automation of what is currently a manual and error-prone process.

**3.1 Meet File Import and Format Auto-Detection.** The system accepts meet entry files in the .hy3 and .ev3 formats produced by Hy-Tek Meet Manager, the dominant meet management software used in competitive swimming in the United States. Upon file upload, the system performs multi-signal format auto-detection by examining file headers, record type indicators, field delimiter patterns, and internal consistency markers to determine the exact format variant and version. This auto-detection is necessary because .hy3 and .ev3 files have evolved across multiple Hy-Tek versions with subtle format variations.

**3.2 Automated Data Extraction.** Once the format is identified, the system parses the file to extract:

- **Event structures:** All events offered in the competition, including event number, stroke, distance, gender restriction, and age group.
- **Qualifying times:** Minimum and/or maximum time standards required for entry into each event, including both qualifying ("QT") and bonus ("BT") time thresholds where applicable.
- **Session schedules:** The organization of events into sessions (e.g., prelims/finals, timed finals, morning/evening sessions).
- **Meet metadata:** Meet name, dates, location, sanctioning body, host organization, and entry deadlines.

**3.3 Cross-Reference Qualification Filtering.** This is a core innovation. After extracting event structures and qualifying standards, the system cross-references each event's requirements against the personal best times stored in the athlete database. For each event, the system:

1. Identifies all athletes on the team roster whose gender matches the event's gender restriction.
2. Retrieves each matching athlete's personal best time for the corresponding event (stroke and distance combination).
3. Applies course-type conversion if necessary (e.g., if the meet is long course meters but the athlete's best time is short course yards, the system applies the appropriate conversion factor, as described in Section 4.4).
4. Compares the athlete's best time (or converted equivalent) against the event's qualifying standard.
5. Classifies each athlete as "qualified," "bonus-qualified" (meeting the bonus time but not the qualifying time), or "not qualified."

The result is a filtered roster for each event showing only eligible athletes, dramatically reducing the coach's workload from hours of manual cross-referencing to minutes of review and selection.

**3.4 Gender-Aware Filtering.** The system enforces gender-appropriate filtering by matching the gender field stored in each athlete's profile against the gender designation of each event. This ensures that when a coach views eligible athletes for a given event, only athletes of the appropriate gender are displayed.

**3.5 Group-Based Quick Entry.** Coaches organize athletes into training groups (e.g., "Senior Group," "Age Group 1," "Novice"). The meet entry interface provides group-level views with real-time counts of how many athletes in each group qualify for each event. Coaches can rapidly enter athletes by group, reviewing qualification status at a glance rather than examining individual athletes one at a time.

**3.6 Auto-Population of Seed Times.** When an athlete is entered into an event, the system automatically populates the seed time field with the athlete's personal best time for that event (with course conversion if applicable). This eliminates yet another manual data entry step and reduces transcription errors.

### 4. Automated Best Times Integration from National Database

**4.1 External Database Integration.** The system includes a server-side integration pipeline that queries publicly available swimming time databases, specifically USA Swimming's time repository as surfaced through aggregation services such as external verified time databases. This integration runs as a serverless function to avoid exposing API credentials or scraping logic to the client.

**4.2 Athlete Identity Resolution.** The system resolves athlete identity by performing a lookup against the external database using the athlete's full name and, where available, their USA Swimming member ID. The identity resolution process handles common name variations and uses the USA Swimming ID as a disambiguation key when multiple athletes share the same name.

**4.3 Time Retrieval.** Upon successful identity resolution, the system retrieves all available competition times for the athlete across all events and course types. Retrieved times include the event description, time value, date of performance, and competition name. These times are persisted to the athlete's record within the METTLE database, tagged with their source and retrieval date.

**4.4 Cross-Course Time Conversion.** Competitive swimming is conducted in three standard course configurations: Short Course Yards (SCY, 25-yard pools), Long Course Meters (LCM, 50-meter pools), and Short Course Meters (SCM, 25-meter pools). An athlete's best time in SCY for a given event is not directly comparable to a qualifying standard expressed in LCM. The system implements conversion algorithms that translate times between course types using established conversion factors recognized by the sport's governing bodies. These conversions enable the meet qualification filtering described in Section 3.3 to function correctly even when an athlete's available times and the meet's qualifying standards are in different course types.

**4.5 Periodic Refresh.** The system supports both on-demand and scheduled periodic refresh of external time data. After an athlete competes in new competitions, their external database records are updated by the governing body. The METTLE system can re-query the external database to retrieve newly posted times, ensuring that the athlete's record within the platform remains current.

### 5. Athlete Relations Manager (ARM)

The ARM subsystem provides a comprehensive athlete profile and relationship management capability analogous to customer relationship management (CRM) systems used in business contexts.

**5.1 Comprehensive Athlete Profiles.** Each athlete's profile aggregates: personal information (name, date of birth, gender, contact information), group assignment, USA Swimming member ID, complete personal best times across all events and course types, full XP history with event-level detail, attendance records across all practice sessions, quest history with submission and approval records, badge collection, streak history, and goal records.

**5.2 Wellness and Journaling.** The ARM includes a wellness tracking module. Athletes can submit daily journal entries through the Athlete Portal recording their physical and mental state, energy level, sleep quality, stress factors, and free-form notes. These entries are visible to the coach through the Coach Portal, providing early-warning indicators of burnout, overtraining, or disengagement. The journaling system is designed to be low-friction, using quick-select scales supplemented by optional free-text fields.

**5.3 Weight Room Integration.** Athletes can log strength and conditioning workouts through the Athlete Portal, recording exercises, sets, reps, and weights. These logs are associated with the athlete's profile and visible to the coach, enabling holistic training oversight that encompasses both sport-specific practice and supplementary conditioning.

**5.4 Performance Analytics and Time Standards Progression.** The system incorporates the USA Swimming Motivational Time Standards framework, which defines 12 progressive achievement levels (e.g., B, BB, A, AA, AAA, AAAA, Sectional, Futures, Junior National, National, Olympic Trials, Olympic). For each event, the system displays the athlete's personal best time in context against these 12 standard levels, showing which levels have been achieved and the precise time gap to the next level. This visualization transforms abstract time values into a concrete progression ladder.

**5.5 Goal Tracking and Gap Analysis.** Athletes can set target times for specific events through the Athlete Portal. The system calculates the gap between the athlete's current best and their target, and further contextualizes this gap against the nearest time standard levels. Coaches can view all athletes' goals and gaps to inform training plan priorities.

### 6. Practice Session Auto-Reset

**6.1 Schedule-Based Detection.** The system maintains a practice schedule (days and times) for each training group. When the current time falls within or immediately before a scheduled practice window, the system detects the onset of a new session.

**6.2 Session Snapshot.** Before clearing session-specific data, the system captures a snapshot of the prior session's state, including which athletes were marked present, which athletes checked in via the Athlete Portal, and any session-specific notes entered by the coach. This snapshot is persisted as a historical session record for use in attendance analytics and XP award audit trails.

**6.3 Zero-Tap Initialization.** Upon detection of a new session, the system automatically clears transient session state (current attendance roster, check-in flags) and presents the coach with a fresh, empty session context. The coach does not need to manually "start" or "reset" a session; opening the Coach Portal at practice time presents an immediately usable interface. This zero-tap initialization reduces friction for coaches operating in the time-pressed environment of practice start.

**6.4 Historical Data Preservation.** All session snapshots are retained indefinitely for analytics purposes. The system can report attendance frequency by athlete, by group, and by time period; identify attendance trends and anomalies; and correlate attendance patterns with XP accumulation and performance improvement.

### 7. Parent Portal with COPPA-Compliant Design

**7.1 Read-Only Progress Visibility.** Parents view a dashboard displaying their child's current XP, level, recent badges, attendance summary, and long-term growth trends (e.g., charted XP accumulation over weeks and months). This visibility is strictly read-only with respect to athlete data; parents cannot modify XP, attendance, or other athlete records.

**7.2 Mediated Encouragement System.** Parents can send encouragement messages to their child through the platform. These messages are drawn from an approved set of encouragement templates or, if free-text is permitted, are visible to the coach before delivery. This mediation ensures appropriateness and prevents the platform from becoming an unsupervised communication channel between adults and minors who may not be their own children.

**7.3 Absence Reporting.** Parents can report upcoming absences through the Parent Portal. These absence reports are surfaced to the coach in the Coach Portal, enabling proactive practice planning and ensuring that absences are not mistaken for disengagement.

**7.4 Communication Architecture.** The system is designed such that no direct, unmediated communication channel exists between any adult user and a minor athlete who is not their own child. All communications flow through structured, logged, and coach-visible pathways, supporting compliance with COPPA and organizational child-safety policies.

### 8. Multi-Sport Extensibility

**8.1 Universal Engagement Layer.** The gamification engine (XP, leveling, quests, streaks, team challenges), the ARM, the parent portal, the practice session management, and the subscription infrastructure are all sport-agnostic by design. These components operate on abstract concepts (activities, achievements, attendance, time-based performance) that are universally applicable across sports.

**8.2 Sport-Specific Performance Modules.** Sport-specific functionality is encapsulated in modular components that plug into the universal layer. For swimming, this module handles swim-specific concepts: stroke types, race distances, course types (SCY/LCM/SCM), time conversions, Hy-Tek file parsing, USA Swimming time standards, and external verified time databases integration. For track and field, an analogous module would handle distances, event types (sprint, hurdle, relay, field), and relevant performance databases. For gymnastics, a module would handle apparatus scores, difficulty values, and execution scores. Each sport-specific module implements a defined interface for performance data that the universal gamification layer consumes, enabling XP awards for "time improvement" (swimming), "distance improvement" (track), or "score improvement" (gymnastics) through a common abstraction.

**8.3 Configuration-Driven Adaptation.** The system uses configuration objects to define sport-specific parameters: the names and structures of events, the applicable performance metrics, the available time/score standard systems, and the external data sources for verified results. Adding support for a new sport requires creating a new sport-specific module and its configuration; the core platform requires no modification.

### 9. Technical Architecture

**9.1 Application Framework.** The platform is implemented as a web application using modern JavaScript-based frameworks supporting server-side rendering and client-side interactivity. The component-based architecture enables the three-portal system to share a common component library while presenting portal-specific layouts and navigation.

**9.2 Dual-Persistence Layer.** The system implements a dual-persistence strategy combining client-side local storage with a cloud-based document database:

- **Client-Side Persistence:** Critical session data, including current practice session state and recently accessed records, are persisted locally on the user's device. This enables offline-first capability: coaches can mark attendance and athletes can check in even when network connectivity is intermittent (a common scenario in natatoriums and outdoor training facilities). A synchronization module detects when connectivity is restored and reconciles local changes with the cloud database, implementing a last-write-wins conflict resolution strategy with conflict logging for manual review when necessary.
- **Cloud Persistence:** A cloud-based document database serves as the authoritative data store. Real-time listener capability enables live updates across portals: when a coach approves a quest in the Coach Portal, the XP award appears in the Athlete Portal in real time without requiring a page refresh.

**9.3 Server-Side API Layer.** External integrations (verified time database lookups, subscription management, future integrations) are implemented as server-side API endpoints. These endpoints execute securely on the server, keeping API credentials, integration logic, and data processing isolated from the client application. The deployment architecture supports automatic scaling and eliminates the need for dedicated server infrastructure.

**9.4 Progressive Web App (PWA).** The application is designed as a Progressive Web App, enabling installation on mobile device home screens, offline functionality via service workers, and push notification support. Given that coaches and athletes primarily interact with the platform on mobile devices at practice facilities, the PWA approach provides a native-app-like experience without requiring app store distribution or platform-specific development.

---

## ABSTRACT

A computer-implemented platform for gamified athlete engagement and intelligent athletic team management is disclosed. The system comprises a three-portal architecture providing role-specific interfaces for coaches, athletes, and parents operating on a shared data layer. A gamification engine awards experience points for verified training activities, implements a six-tier leveling system, provides a quest-assignment-and-approval workflow, supports team challenges, and applies streak-based XP multipliers. An intelligent meet management subsystem imports standardized competition meet files, automatically extracts qualifying standards, and cross-references those standards against athlete personal best times to produce filtered rosters of eligible athletes with auto-populated seed times. An automated integration pipeline retrieves verified competition times from external national databases and performs cross-course-type time conversions. An Athlete Relations Manager provides comprehensive profiles with wellness tracking, weight room logging, performance analytics against standardized achievement levels, and goal-gap analysis. Practice session auto-reset eliminates manual session initialization. A parent portal provides COPPA-compliant read-only progress visibility with mediated communication. The architecture supports multi-sport extensibility through sport-specific modules plugging into a universal engagement layer. The platform is delivered as a progressive web application with offline-first capability and cloud synchronization.

---

*This provisional patent application is filed to establish a priority date for the invention described herein. The inventor reserves the right to file a non-provisional application claiming priority to this provisional application within twelve (12) months of the filing date, and to include formal claims, additional embodiments, and formal drawings at that time.*

---

**Inventor:** Ramon Walton
**Assignee:** Parallax Ventures
**Date:** February 18, 2026
