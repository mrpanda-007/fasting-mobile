# Timer and local history implementation plan

## Product guarantees

1. Starting a fast persists it before the UI reports success.
2. A running fast remains logically active across backgrounding, process death, device restart, and app upgrades.
3. Reaching the target duration does not stop or complete a fast. It changes the derived display to `target reached` or overtime. Only an explicit user action ends the fast.
4. Rolling phases never advance silently. Ending a fast may start its configured refeed; completing a refeed leaves the next fast ready until the user starts it.
5. History is append-safe and preserves the protocol as it existed when the fast began.
6. No per-second database writes and no continuously running background JavaScript process.

## Platform contract

“Timer keeps running” means the durable fast remains active and elapsed time is derived from timestamps. It does not mean the application process remains alive.

- Foreground: render from `Date.now()` using a single display ticker. Update once per second only while a timer screen showing seconds is visible; use a slower cadence elsewhere.
- Background: stop the display ticker. Perform no timer work and consume effectively no timer-related CPU.
- Resume or cold launch: load the active record and derive the current snapshot immediately.
- Target alert: optionally schedule one native local notification for `targetAt`. Store its identifier so ending or editing the fast can cancel and replace it.
- Background sync: later use a deferrable system-scheduled job only for account sync, never to keep time.

The design must remain correct if a background job or notification never executes. iOS does not allow arbitrary continuous background execution, and Android may kill a cached process. Force-stopping an app can also suppress platform work until the user opens it again.

## Supported protocol types

All presets compile into one normalized `ProtocolSnapshot`; the timer engine does not branch on display names.

| UI protocol | Normalized phases | Repetition |
| --- | --- | --- |
| 16:8 | 16h fast, 8h refeed | configurable schedule/run |
| 18:6 | 18h fast, 6h refeed | configurable schedule/run |
| OMAD | 23h fast, 1h refeed | configurable schedule/run |
| 24h Fast | 24h fast | once |
| Rolling | chosen fast + refeed | finite count or open-ended |
| Custom | one or more chosen phases | once, finite, or open-ended |

Store integer milliseconds and absolute UTC epoch milliseconds. Store the timezone identifier and UTC offset only as historical display context.

## Domain model additions

Extend the current fasting domain with these concepts:

- `ProtocolSnapshot`: immutable copy of phase durations, repeat rule, name, and version at start.
- `PlanRun`: one execution of a protocol; owns current cycle, status, and timestamps.
- `PhaseRun`: one fast or refeed occurrence with planned duration, start, target, explicit end, and end reason.
- `ActiveTimer`: singleton pointer to the currently running `PhaseRun`.
- `TimerSnapshot`: derived remaining/overtime duration and progress for rendering; never stored every second.
- `HistoryEntry`: query model assembled from completed/ended/cancelled runs.
- `TimerEvent`: append-only audit event such as started, target reached when observed, ended, refeed started, or plan cancelled.

Recommended statuses:

- Plan: `draft | active | awaitingNextPhase | completed | cancelled`
- Phase: `pending | active | ended`
- Explicit phase end reason: `completedAtOrAfterTarget | endedEarly | planCancelled`

Do not persist `targetReached` as a terminal status. Derive it from `now >= targetAt` while the phase remains active.

## SQLite storage

Use `expo-sqlite` with WAL enabled and numbered migrations. SQLite persists across app restarts and suits relational history queries better than key-value storage.

Tables:

1. `schema_migrations(version, applied_at)`
2. `protocols(id, owner_id, name, definition_json, created_at, updated_at)`
3. `plan_runs(id, owner_id, protocol_snapshot_json, status, current_cycle, repeat_count, started_at, ended_at, revision, created_at, updated_at)`
4. `phase_runs(id, plan_run_id, cycle_number, phase_index, kind, planned_duration_ms, started_at, target_at, ended_at, end_reason, created_at, updated_at)`
5. `active_timer(slot PRIMARY KEY CHECK slot = 1, phase_run_id UNIQUE, notification_id, updated_at)`
6. `timer_events(id, plan_run_id, phase_run_id, type, occurred_at, payload_json)`
7. `sync_outbox(id, entity_type, entity_id, operation, local_revision, payload_json, created_at, attempt_count)`

Constraints and indexes:

- Foreign keys enabled.
- Only one row can occupy `active_timer`.
- Index `phase_runs(plan_run_id, cycle_number, phase_index)`.
- Index `plan_runs(status, started_at DESC)` for active restoration and History.
- Index `timer_events(plan_run_id, occurred_at)`.
- Start/end/advance operations run inside SQLite transactions.

## Commands and queries

Feature screens call use cases, not repositories directly.

Commands:

- `startProtocol(protocolInput, now)`
- `endActiveFast(now)`
- `startRefeed(now)`
- `endRefeed(now)`
- `startNextFast(now)`
- `cancelPlan(now)`
- `editActiveTarget(newTargetAt, now)` if product-approved

Queries:

- `restoreActiveTimer()`
- `getTimerSnapshot(now)`
- `listHistory(cursor, filters)`
- `getHistoryEntry(planRunId)`

Every command returns the committed domain record. The UI changes only after the transaction succeeds.

## State transitions

### Standalone fast

`none -> active fast -> explicitly ended -> history`

Passing `targetAt` leaves the phase active and displays overtime. `endActiveFast` records whether the user ended early or at/after target.

### Rolling plan

`draft -> active fast -> explicitly end fast -> refeed ready/active -> explicitly end refeed -> next fast ready -> explicitly start next fast`

After the final configured cycle, explicitly ending its final phase completes the plan. An open-ended rolling plan remains available for another cycle until the user cancels/finishes the plan.

### Recovery

On launch/resume:

1. Open and migrate the database.
2. Read `active_timer` and its phase/plan in one query.
3. Validate references and timestamps.
4. Derive a snapshot from the current clock.
5. Reconcile the stored notification identifier.
6. Publish hydrated state, then render the main app.

If data is inconsistent, preserve the records, clear no history automatically, and surface a recoverable error state.

## Clock changes

Absolute wall-clock timestamps are required across process death and reboot. While the process is alive, also record a monotonic-clock anchor in memory. On resume, compare wall-clock and monotonic elapsed time when available. If the wall clock moved materially, keep the stored timestamps, record a diagnostic event, and make the discrepancy visible for later product handling rather than silently rewriting history.

## Local history rules

- History is generated from `plan_runs` and `phase_runs`, never from UI state.
- Save the full protocol snapshot on every run so editing a preset cannot rewrite old history.
- A standalone fast is one plan run with one phase.
- A rolling entry is one plan run containing ordered cycles and phases.
- Preserve early endings and cancellations as neutral facts.
- Deleting history should be a separate, explicit, recoverable product decision.

## Folder implementation

```text
src/
  domain/fasting/
    models.ts
    timer.ts
    protocol.ts
    transitions.ts
  data/
    contracts/
    local/sqlite/
      database.ts
      migrations/
      fastingRepository.ts
      historyRepository.ts
      transaction.ts
  features/fasting/
    services/
      startProtocol.ts
      endActiveFast.ts
      advanceRollingPlan.ts
      restoreActiveTimer.ts
    hooks/
      useActiveTimer.ts
  features/history/
    services/
      listHistory.ts
      getHistoryEntry.ts
  services/
    clock/
      clock.ts
      systemClock.ts
    lifecycle/
      appLifecycle.ts
    notifications/
      timerNotification.ts
  state/
    appSession.ts
    timerStore.ts
```

## Test matrix

Unit tests:

- Every protocol normalization path.
- Before, exactly at, and after target time.
- Early end and overtime end.
- Rolling finite and open-ended transitions.
- Daylight-saving/timezone changes and manual wall-clock changes.
- Atomic failure during start/end/advance.

Device integration tests on Android and iOS:

- Background for minutes and hours, then resume.
- Swipe away from recents, wait, reopen.
- OS kills the process under memory pressure, then reopen.
- Device restart during a fast.
- App update/migration during a fast.
- Notification permission allowed and denied.
- End fast while offline, then restart.
- Android Settings “Force stop” and iOS user force-quit: verify data restoration on manual reopen; do not promise background execution or notification delivery while the OS suppresses the app.

## Delivery phases

1. Database, migrations, repositories, and deterministic clock abstraction.
2. Protocol normalization and pure transition tests.
3. Start/end/restore use cases with transactional history writes.
4. Foreground display ticker and app lifecycle restoration.
5. Optional local target notifications.
6. Replace static Today and History data with repository-backed state.
7. Add account sync later through the existing outbox and repository contracts.

## Primary platform references

- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo Background Task](https://docs.expo.dev/versions/latest/sdk/background-task/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Android processes and app lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle)
- [Apple background execution limits](https://developer.apple.com/forums/thread/685525)
