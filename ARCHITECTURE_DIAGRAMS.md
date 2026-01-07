# CRDT State Management Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHALLENGE SWITCHING FLOW                     │
└─────────────────────────────────────────────────────────────────┘

User clicks "Next Challenge"
         │
         ▼
    ┌─────────────────────┐
    │  Zustand Store      │ ← Current challenge ID changes
    │  challengeId: 1→2   │
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  useChallengeContent Hook               │
    │  receives new normalizedChallengeId     │
    └────────┬────────────────────────────────┘
             │
    ┌────────┴────────────────────────────────┐
    │                                          │
    ▼                                          ▼
┌──────────────────────────┐      ┌───────────────────────────┐
│  Phase 1: On Challenge   │      │  NEW: Invalidation Phase  │
│  Change Effect           │      │  (when challengeId changes)│
├──────────────────────────┤      ├───────────────────────────┤
│ - Unsubscribe from CRDT  │      │ - Invalidate cache for    │
│ - Reset state            │      │   old challenge           │
│ - Load language pref     │      │ - Forces refetch of new   │
│ - Set new language       │      │   challenge data          │
└───────────┬──────────────┘      └──────────┬────────────────┘
            │                                 │
            └──────────────┬──────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │   TanStack Query             │
            │   (Cache Invalidated)        │
            │   → Auto-refetch triggers    │
            └──────────────┬───────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │   API Call to Backend        │
            │   GET /sessions/{id}/content │
            │   for Challenge 2            │
            └──────────────┬───────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │   Database                   │
            │   Returns Challenge 2 data:  │
            │   {                          │
            │     content: "",             │
            │     started: false,          │
            │     language: "python"       │
            │   }                          │
            └──────────────┬───────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │   Update Cache               │
            │   (new data available)       │
            └──────────────┬───────────────┘
                           │
    ┌──────────────────────┴────────────────────────┐
    │                                               │
    ▼                                               ▼
┌──────────────────────────┐      ┌────────────────────────────┐
│  Phase 2: Starter Logic  │      │  Phase 1b: Refetch on Lang │
├──────────────────────────┤      ├────────────────────────────┤
│ Check:                   │      │ If language just loaded:   │
│ - content === "" ?       │      │ - Call refetch()           │
│ - started === false ?    │      │ - Get content for language │
│                          │      └────────────────────────────┘
│ If both true:            │
│ - Apply starter code     │
│ - Update query cache     │
│ - Keep DB marked empty   │
└───────────┬──────────────┘
            │
            ▼
    ┌──────────────────────────────┐
    │  Phase 3: CRDT Sync Setup    │
    ├──────────────────────────────┤
    │ - Subscribe to Relay for:    │
    │   Challenge 2 + Language     │
    │ - Listen for real-time       │
    │   updates from other users   │
    │ - Publish local edits to     │
    │   CRDT (via Relay)           │
    └───────────┬──────────────────┘
                │
                ▼
    ┌──────────────────────────────┐
    │  User can edit content       │
    │  - Real-time sync works ✓    │
    │  - Other users see changes   │
    │  - Polling saves to DB       │
    └──────────────────────────────┘
```

## State Management Layers

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: ZUSTAND (Session State)                    │
│ ├─ sessionId                                        │
│ ├─ challengeId ← USER CHANGES THIS                  │
│ └─ currentLanguage                                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Triggers hook reactivity
                   │
┌──────────────────▼──────────────────────────────────┐
│ Layer 2: TANSTACK QUERY (Content Cache)             │
│ ├─ Key: ['challenge-content', sessionId,            │
│ │        challengeId, contentType, language]        │
│ ├─ Data: {content, language, started}               │
│ ├─ Status: idle|loading|success|error               │
│ └─ Stale: invalidated when challengeId changes     │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Refetch on invalidate
                   │
┌──────────────────▼──────────────────────────────────┐
│ Layer 3: DATABASE (Persistent State)                │
│ ├─ Sessions table: {id, sessionId, userId}          │
│ ├─ ChallengeContent table:                          │
│ │  {sessionId, challengeId, language,               │
│ │   content, started, updatedAt}                    │
│ └─ ContentHistory table: (for language switches)    │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Polling syncs every 5s
                   │
┌──────────────────▼──────────────────────────────────┐
│ Layer 4: CRDT (Real-time Sync)                      │
│ ├─ Relay: per (sessionId:challengeId:language)     │
│ ├─ Yjs Y.Doc: shared document state                │
│ ├─ Multiplayer updates in milliseconds              │
│ └─ WebSocket: real-time bindings                    │
└─────────────────────────────────────────────────────┘
```

## Phase Execution Order

```
Timeline for Challenge Switch:

T+0ms:   User clicks "Next" button
         └─ Zustand challengeId changes: 1→2

T+0ms:   Phase 1 effect fires
         └─ Unsubscribe from old CRDT
         └─ Load language preference

T+1ms:   Invalidation effect fires
         └─ queryClient.invalidateQueries()
         └─ Cache marked as stale

T+2ms:   TanStack Query detects stale
         └─ Automatically refetch starts

T+50ms:  API returns new challenge data
         └─ Cache updated with new data

T+51ms:  Phase 2 effect fires (data dependency)
         └─ Checks: content === "" && started === false
         └─ If true: Apply starter code

T+52ms:  Phase 3 effect fires (after Phase 2)
         └─ Subscribe to new challenge CRDT
         └─ Ready for real-time updates

T+53ms:  Ready for user input
         └─ Editor can receive edits
         └─ Real-time sync is active

TOTAL:   ~50ms from click to ready (imperceptible)
```

## Key Invariants Maintained

```
1. Data Consistency
   ├─ Cache data matches DB data
   ├─ All phases work with same data version
   └─ No stale reads

2. Unidirectional Flow
   ├─ UI updates Zustand
   ├─ Zustand invalidates cache
   ├─ Cache fetches fresh data
   ├─ Phases process fresh data
   └─ No feedback loops

3. Real-time Guarantee
   ├─ CRDT always has correct challenge context
   ├─ Edits publish to right doc
   ├─ Updates consumed from right doc
   └─ No cross-challenge data leakage

4. Polling Persistence
   ├─ Every 5s: local content → DB
   ├─ Only if content changed
   ├─ Updates marked as 'started'
   └─ Recovers from sync failures
```

## Dependencies Analysis

### Phase 1 (Language Loading)
```typescript
useEffect(() => {
  // ... language loading logic
}, [sessionId, normalizedChallengeId, repository])

Why these?
- sessionId: needed to identify which session
- normalizedChallengeId: resets subscription on change
- repository: stable reference for API calls
```

### Invalidation Phase (NEW)
```typescript
useEffect(() => {
  queryClient.invalidateQueries({...})
}, [sessionId, normalizedChallengeId, queryClient])

Why these?
- sessionId: needed for query key
- normalizedChallengeId: fires when challenge changes
- queryClient: stable API client reference
```

### Phase 2 (Starter Application)
```typescript
useEffect(() => {
  // ... starter logic
}, [data, isLoading, currentLanguage, queryClient, queryKey])

Why NOT normalizedChallengeId?
- Phase 3 already guards on it
- Including it would fire before new data loads
- Keep Phase 2 focused on: "data ready? apply starter?"
```

### Phase 3 (CRDT Sync)
```typescript
useEffect(() => {
  // ... CRDT subscription
}, [sessionId, normalizedChallengeId, contentType, 
    enableRealtime, currentLanguage, isLanguageInitialized])

Why these?
- sessionId: needed for CRDT context
- normalizedChallengeId: resets subscription on change
- contentType: different content types need different docs
- currentLanguage: language affects which doc
- isLanguageInitialized: guards until ready
- enableRealtime: toggles sync feature
```

## What Was Wrong Before

```
Old Problem:
┌─ normalizedChallengeId changes (1→2)
├─ Phase 3 ref tracking prevented re-execution
├─ Unsubscribe never happened
├─ Query cache never invalidated
├─ Old data still in cache
├─ Phase 2 sees old data: "content !== empty", skips starter
├─ Phase 3 subscribes to old challenge CRDT
└─ Sync breaks, starter doesn't apply

Root Cause:
- Manual tracking (syncSetupKeyRef) interfered with React's
  natural effect re-execution based on dependencies
- Missing explicit invalidation trigger
- Cache never marked stale on challenge change
```

## What Works Now

```
New Solution:
┌─ normalizedChallengeId changes (1→2)
├─ Phase 1 effect fires: unsubscribe from old CRDT
├─ Invalidation effect fires: mark cache stale
├─ Query auto-refetch: fetch new challenge data
├─ Phase 2 effect fires: applies starter if needed
├─ Phase 3 effect fires: subscribes to new CRDT
└─ Sync works, starter applies correctly

Why it works:
- No manual tracking interfering
- React dependency tracking works as designed
- Explicit invalidation ensures fresh data
- Phases receive correct data for their logic
```

## Performance Characteristics

```
Memory:
├─ Each challenge-language pair cached (small)
├─ Cache cleared on session end
└─ No memory leaks from ref tracking

CPU:
├─ Single refetch per challenge switch
├─ Polling runs every 5s (background)
├─ CRDT updates in real-time
└─ No busy loops or continuous re-renders

Network:
├─ GET /content per challenge: ~1 call
├─ POST /content per 5s of editing: ~1 call
├─ WebSocket: continuous (same socket)
└─ Total: O(1) per switch + O(n/5s) for edits
```
