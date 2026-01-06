# CRDT Architecture - Syncing Multiple Content Types

This document explains the generic CRDT synchronization architecture that supports any type of challenge content.

## Overview

The CRDT (Conflict-free Replicated Data Type) system is built on **Yjs** and uses a relay server to synchronize content between clients in real-time. The architecture is designed to be **content-agnostic**, supporting:

- ✅ **Code challenges** (current)
- 🔄 **Architecture challenges** (future)
- 🔄 **Database design challenges** (future)
- 🔄 **AI/ML challenges** (future)
- 🔄 **Any custom challenge type**

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Interview Frontend                 │
│  ┌──────────────────────────────────────────┐  │
│  │  useCrdtContent Hook                     │  │
│  │  - Generic for any contentType           │  │
│  │  - Manages Y.Doc and Y.Text sync         │  │
│  └──────────────────────────────────────────┘  │
│           ↓ WebSocket ↓                        │
│  ┌──────────────────────────────────────────┐  │
│  │  CodeEditor / ContentEditor Components  │  │
│  │  - Uses useCrdtContent hook              │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↓
           ┌──────────────────────┐
           │   Yjs Relay Server   │
           │  (yjs-relay/)        │
           │                      │
           │  Session Key:        │
           │  ${sessionId}:        │
           │  ${challengeId}:      │
           │  ${contentType}       │
           │                      │
           │  Y.Doc with Y.Map    │
           │  for multi-type      │
           │  content storage     │
           └──────────────────────┘
                      ↓
           ┌──────────────────────┐
           │  S3 (Optional)       │
           │  Snapshots per       │
           │  challenge           │
           └──────────────────────┘
```

## Key Components

### 1. **Relay Server** (`yjs-relay/server.js`)

#### Session Key Management
```javascript
// Format: sessionId:challengeId:contentType
const sessionKey = getSessionKey(sessionId, challengeId, contentType)
// Returns: "session-123:challenge-456:code"
```

#### Session Storage
- Each session/challenge/content-type combination gets its own **Y.Doc**
- The Y.Doc contains a **Y.Map** (`content`) that can hold any serializable content
- Multiple clients in the same session/challenge share one Y.Doc

#### WebSocket Connection URL
```
ws://localhost:1234/yjs?sessionId=xxx&challengeId=yyy&contentType=zzz&token=jwt
```

**Parameters:**
- `sessionId`: Interview session ID (required)
- `challengeId`: Unique challenge identifier (required)
- `contentType`: Type of content ('code', 'architecture', 'database', etc.)
- `token`: JWT token for authentication

### 2. **useCrdtContent Hook** (`web/src/hooks/useCrdtContent.ts`)

Generic React hook for syncing ANY type of content.

#### Usage
```typescript
const { getContent, updateContent, contentRef } = useCrdtContent({
  enabled: true,
  sessionId: 'session-123',
  challengeId: 'challenge-456',
  contentType: 'code',        // or 'architecture', 'database', etc.
  yjsUrl: 'ws://localhost:1234/yjs',
  onContentChange: (content) => console.log('Content changed:', content),
})

// Read content
const currentContent = getContent()

// Update content
updateContent('new content here')
```

#### How It Works
1. Connects to relay with `sessionId`, `challengeId`, `contentType`
2. Creates a Y.Doc and Y.Text for the content
3. Listens to WebSocket messages (remote updates)
4. Sends local updates back to relay via WebSocket
5. Relay broadcasts to all clients in same session/challenge

### 3. **CodeEditor Component**

Simplified to use the generic hook:

```typescript
<CodeEditor
  code={code}
  language={language}
  onChange={handleCodeChange}
  useCrdt={enableCrdt}
  sessionId={sessionId}
  challengeId={challengeId}  // NOW REQUIRED
  yjsUrl={yjsUrl}
/>
```

## Adding a New Content Type

### Step 1: Create a New Hook (Optional)

You can either use `useCrdtContent` directly or create a wrapper:

```typescript
// web/src/hooks/useArchitectureSync.ts
export function useArchitectureSync(sessionId, challengeId) {
  return useCrdtContent({
    enabled: true,
    sessionId,
    challengeId,
    contentType: 'architecture',
    yjsUrl: 'ws://localhost:1234/yjs',
    onContentChange: (arch) => console.log('Architecture updated:', arch),
  })
}
```

### Step 2: Create a Component

```typescript
// web/src/components/Editor/ArchitectureEditor.tsx
export const ArchitectureEditor: React.FC<Props> = ({
  sessionId,
  challengeId,
  initialArchitecture,
}) => {
  const { getContent, updateContent } = useArchitectureSync(sessionId, challengeId)
  
  return (
    <div className="architecture-editor">
      {/* Render architecture diagram/editor */}
      {/* Call updateContent() when architecture changes */}
    </div>
  )
}
```

### Step 3: Use in Challenge Views

```typescript
// In InterviewSession.tsx or custom challenge view
<ArchitectureEditor
  sessionId={sessionId}
  challengeId={challenges[syncedChallengeIndex]?.id}
/>
```

**That's it!** The relay automatically handles:
- ✅ Session isolation by `sessionId:challengeId:contentType`
- ✅ Real-time sync across all clients
- ✅ Persistent snapshots to S3 (if enabled)
- ✅ JWT authentication

## Session Isolation

Each challenge gets its **own state**, isolated by session + challenge + content-type:

```
Session: interview-session-1
├── Challenge 1 (id: ch-001)
│   ├── code (Y.Doc) → synced between all clients
│   └── architecture (Y.Doc) → separate Y.Doc
├── Challenge 2 (id: ch-002)
│   ├── code (Y.Doc) → separate, isolated from Challenge 1
│   └── architecture (Y.Doc)
└── Challenge 3 (id: ch-003)
    ├── code (Y.Doc)
    └── database (Y.Doc)
```

When users switch challenges, they automatically connect to the correct Y.Doc via the `challengeId` parameter.

## Persistence

### S3 Snapshots

If `ENABLE_S3_SNAPSHOT=true`, the relay persists snapshots:

```
s3://bucket-name/yjs/session-123_challenge-456_code.bin
s3://bucket-name/yjs/session-123_challenge-456_architecture.bin
```

The snapshot key format: `${S3_PREFIX}${sessionKey.replace(/:/g, '_')}.bin`

### In-Memory State

- Sessions are stored in-memory by default
- For high-traffic scenarios, consider implementing:
  - Redis-backed session storage
  - Database snapshots
  - Automatic cleanup of stale sessions

## Security Considerations

1. **JWT Validation**: Every WebSocket connection requires a valid JWT token
2. **Role-Based Access**: 
   - `interviewer` role: can write
   - `interviewee` role: can write
   - `viewer` role: read-only
3. **Session Isolation**: Tokens must match the session they're connecting to (implement server-side validation)

## Example: Adding Database Design Challenge

```typescript
// Step 1: Create component
export const DatabaseDesignEditor: React.FC<Props> = ({
  sessionId,
  challengeId,
}) => {
  const { getContent, updateContent } = useCrdtContent({
    enabled: true,
    sessionId,
    challengeId,
    contentType: 'database_schema',  // New content type!
    yjsUrl: 'ws://localhost:1234/yjs',
    onContentChange: (schema) => saveSchema(schema),
  })

  return (
    <div className="db-designer">
      {/* Schema visualization */}
      <button onClick={() => updateContent(newSchema)}>
        Update Schema
      </button>
    </div>
  )
}

// Step 2: Use in challenge view
<DatabaseDesignEditor
  sessionId={sessionId}
  challengeId={currentChallenge.id}
/>

// Step 3: That's all! Relay handles the rest
```

## Performance Tuning

### Configuration (`yjs-relay/server.js`)

```javascript
const SNAPSHOT_INTERVAL = Number(process.env.SNAPSHOT_INTERVAL || 20)
// Persist snapshot after every 20 updates

const PORT = process.env.PORT ? Number(process.env.PORT) : 1234
// Relay server port

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret'
// JWT signing secret
```

### Optimization Tips

1. **Reduce snapshot frequency** for many edits:
   ```bash
   SNAPSHOT_INTERVAL=100
   ```

2. **Use in-memory only** for high-latency scenarios:
   ```bash
   ENABLE_S3_SNAPSHOT=false
   ```

3. **Monitor relay memory** for long-running sessions:
   - Implement session timeout
   - Auto-cleanup after inactivity

## Troubleshooting

### WebSocket Not Connecting

Check:
- ✅ JWT token is valid
- ✅ `challengeId` is being passed
- ✅ `yjsUrl` matches relay server address
- ✅ Relay server is running and healthy

### Content Not Syncing

Check:
- ✅ `useCrdtContent` hook is being used
- ✅ Both clients are connected to same `sessionId:challengeId:contentType`
- ✅ No errors in browser console or relay logs

### Snapshots Not Being Saved

Check:
- ✅ `ENABLE_S3_SNAPSHOT=true`
- ✅ AWS credentials are configured
- ✅ S3 bucket name is set
- ✅ Bucket has write permissions

## Future Improvements

- [ ] Redis-backed session storage for distributed relays
- [ ] Database persistence for historical snapshots
- [ ] Presence awareness (see who else is editing)
- [ ] Conflict-free undo/redo
- [ ] Offline-first sync
- [ ] End-to-end encryption for E2E challenges
