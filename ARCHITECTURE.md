# Arquitetura Completa - SourceRank Platform

## 🏗️ Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOURCERANK INTERVIEW PLATFORM                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              Internet/Browser
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐  ┌─────────────┐ ┌──────────────┐
            │  Frontend   │  │   WebSocket │ │    Runner    │
            │  React 19   │  │  Socket.io  │ │  (Executor)  │
            │  (5173)     │  │   (4000)    │ │   (3001)     │
            └──────┬──────┘  └──────┬──────┘ └──────┬───────┘
                   │                │               │
                   │   REST API     │   WebSocket   │
                   │   + WebSocket  │               │
                   └────────┬───────┴───────────────┘
                            │
              ┌─────────────▼──────────────────┐
              │      BACKEND API               │
              │    Node.js + Express.js        │
              │    TypeScript (4000)           │
              │  ┌──────────────────────────┐  │
              │  │  Express Middleware      │  │
              │  ├──────────────────────────┤  │
              │  │ Auth │ CORS │ Error      │  │
              │  └──────────────────────────┘  │
              │  ┌──────────────────────────┐  │
              │  │  Route Handlers          │  │
              │  ├──────────────────────────┤  │
              │  │ /auth │ /challenges │... │  │
              │  └────────┬──────────────────┘  │
              │           │                     │
              │  ┌────────▼──────────────────┐  │
              │  │  Service Layer           │  │
              │  ├────────────────────────┤  │
              │  │ • AuthService          │  │
              │  │ • ChallengeService     │  │
              │  │ • SessionService       │  │
              │  │ • ExecutionService     │  │
              │  └────────┬────────────────┘  │
              │           │                   │
              │  ┌────────▼──────────────────┐ │
              │  │  Database Layer          │ │
              │  └──────────────────────────┘ │
              └──────────────┬────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    PostgreSQL (5432)        │
              │  ┌──────────────────────┐   │
              │  │ users                │   │
              │  │ challenges           │   │
              │  │ sessions             │   │
              │  │ executions           │   │
              │  │ logs                 │   │
              │  └──────────────────────┘   │
              └──────────────────────────────┘
```

---

## 📦 Estrutura Modular da API

```
api/src/
│
├── config/                          [CONFIGURAÇÃO CENTRALIZADA]
│   ├── env.ts                       • Variáveis de ambiente
│   └── database.ts                  • Pool PostgreSQL + Schema
│
├── modules/                         [LÓGICA DE NEGÓCIO - 5 MÓDULOS]
│   │
│   ├── auth/                        [AUTENTICAÇÃO]
│   │   ├── auth.types.ts            • User, UserRole types
│   │   ├── auth.service.ts          • JWT, bcryptjs
│   │   ├── auth.controller.ts       • register, login, me
│   │   └── auth.routes.ts           • POST /auth/...
│   │
│   ├── challenges/                  [GERENCIAMENTO DE DESAFIOS]
│   │   ├── challenge.types.ts       • Challenge interface
│   │   ├── challenge.service.ts     • CRUD operations
│   │   ├── challenge.controller.ts  • Handlers
│   │   └── challenge.routes.ts      • GET/POST /challenges
│   │
│   ├── sessions/                    [SESSÕES DE ENTREVISTA]
│   │   ├── session.types.ts         • Session interface
│   │   ├── session.service.ts       • Create, update, list
│   │   ├── session.controller.ts    • Handlers
│   │   └── session.routes.ts        • GET/POST /sessions
│   │
│   ├── execution/                   [ORQUESTRAÇÃO DE EXECUÇÃO]
│   │   ├── execution.types.ts       • Execution interface
│   │   ├── execution.service.ts     • Submit, track, report
│   │   ├── execution.controller.ts  • Handlers
│   │   └── execution.routes.ts      • POST /executions
│   │
│   └── users/                       [GERENCIAMENTO DE USUÁRIOS]
│       └── (preparado para expansão)
│
├── middlewares/                     [EXPRESS MIDDLEWARES]
│   └── auth.middleware.ts           • JWT verify, Role check
│
├── websocket/                       [SOCKET.IO GATEWAYS]
│   └── execution.gateway.ts         • Real-time logs broadcast
│
├── utils/                           [UTILITÁRIOS]
│   └── errors.ts                    • AppError, ValidationError, etc
│
├── app.ts                           [EXPRESS CONFIGURATION]
│   └── CORS, routes, error handling
│
└── server.ts                        [INICIALIZAÇÃO]
    └── HTTP server + Socket.io + DB init
```

---

## 🔄 Fluxo de Autenticação

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION FLOW                         │
└─────────────────────────────────────────────────────────────┘

CLIENT                            API SERVER

  │                                 │
  │─── POST /auth/register ────────▶│
  │     { email, password,         │
  │       role, name }              │
  │                                 │
  │                     ┌──────────┐│
  │                     │1. Validate   │
  │                     │2. Hash pwd   │
  │                     │3. Create user│
  │                     └──────────┘│
  │                                 │
  │◀──── 201 Created ──────────────│
  │     { user, token }             │
  │                                 │
  │─── POST /auth/login ───────────▶│
  │     { email, password }          │
  │                                 │
  │                     ┌──────────┐│
  │                     │1. Find user  │
  │                     │2. Verify pwd │
  │                     │3. Sign JWT   │
  │                     └──────────┘│
  │                                 │
  │◀──── 200 OK ───────────────────│
  │     { user, token }             │
  │                                 │
  │─── GET /auth/me ───────────────▶│
  │     Authorization: Bearer token  │
  │                                 │
  │                     ┌──────────┐│
  │                     │1. Verify JWT │
  │                     │2. Get user   │
  │                     └──────────┘│
  │                                 │
  │◀──── 200 OK ───────────────────│
  │     { user }                    │
```

---

## 📊 Fluxo de Execução de Código

```
┌──────────────────────────────────────────────────────────────────┐
│              CODE EXECUTION FLOW (Real-time)                     │
└──────────────────────────────────────────────────────────────────┘

CANDIDATE                   API SERVER                    RUNNER
(Browser)                   (Backend)                   (Executor)

    │                          │                           │
    │─ POST /executions ──────▶│                           │
    │  { code, language }       │                           │
    │                           │                           │
    │            ┌─────────────┐│                           │
    │            │1. Create exec│                           │
    │            │2. Store to DB│                           │
    │            └─────────────┘│                           │
    │                           │                           │
    │◀─ 202 Accepted ──────────│                           │
    │  { executionId }          │                           │
    │                           │                           │
    │         ┌─────────────────│──────────────────┐        │
    │         │                 │                   │        │
    │         │                 │ HTTP POST /execute        │
    │ JOIN    │                 │─────────────────▶│        │
    │ WebSocket               { executionId,       │        │
    │ room    │                  code, language }  │        │
    │         │                                    │        │
    │         │                 ┌────────────────┐ │
    │         │                 │1. Create       │ │
    │         │                 │   container    │ │
    │         │                 │2. Execute code │ │
    │         │                 └────────────────┘ │
    │         │                                    │
    │         │◀─ Logs streamed via stdout/stderr │
    │         │                                    │
    │         │ HTTP POST /executions/id/report  │
    │         │◀────────────────────────────────-│
    │         │  { status, stdout, stderr,       │
    │         │    exitCode, time }              │
    │         │                                   │
    │         │ UPDATE database                   │
    │         │                                   │
    │ WebSocket │ execution-status event         │
    │◀───────────┤ { status, output }             │
    │ Atualiza   │                               │
    │ Terminal   │                               │
    │            │                               │

Timeline:
┌────────────────────────────────────────────────────┐
│ Submission → Container Start → Code Execute → Done │
│    ~0ms         ~100ms           ~50-5000ms    ~50ms │
│ Total: 30s timeout per execution                  │
└────────────────────────────────────────────────────┘
```

---

## 🗄️ Banco de Dados - Relacionamentos

```
┌──────────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA DIAGRAM                        │
└──────────────────────────────────────────────────────────────────┘

        ┌─────────────────────┐
        │      USERS          │
        ├─────────────────────┤
        │ id (PK)             │
        │ email (UNIQUE)      │
        │ password_hash       │
        │ role                │◄──┐
        │ name                │   │
        │ created_at          │   │
        │ updated_at          │   │
        └──────┬──────────────┘   │
               │                  │
         ┌─────┴─────┐            │
         │           │            │
    ┌────▼────┐  ┌────▼────┐    │
    │          │  │          │   │
    ▼          │  ▼          │   │ created_by
┌──────────────┼──────────────┐  │
│ CHALLENGES   │  SESSIONS    │  │
├──────────────┼──────────────┤  │
│ id (PK)      │ id (PK)      │  │
│ title        │ interviewer_id──┘
│ description  │ interviewee_id──┐
│ difficulty   │ current_       │
│ examples     │ challenge_id   │
│ created_by   ├─(FK)──────────┐│
│ timestamps   │              ││
└──────┬───────┤ status       ││
       │       │ timestamps   ││
       │       └──────┬──────┘│
       │              │       │
       │        ┌─────┘       │
       │        │             │
       │        ▼             │
       │   ┌──────────────┐   │
       │   │  EXECUTIONS  │   │
       │   ├──────────────┤   │
       │   │ id (PK)      │   │
       │   │ session_id   │◄──┤
       │   │ challenge_id │◄──┘
       └──▶│ language     │
           │ code         │
           │ status       │
           │ stdout       │
           │ stderr       │
           │ exit_code    │
           │ exec_time    │
           │ timestamps   │
           └────┬─────────┘
                │
                ▼ (1..*)
           ┌──────────────┐
           │    LOGS      │
           ├──────────────┤
           │ id (PK)      │
           │ execution_id │ (FK)
           │ message      │
           │ level        │
           │ created_at   │
           └──────────────┘
```

---

## 🔌 WebSocket Events Map

```
┌─────────────────────────────────────────────────────────────────┐
│            WEBSOCKET COMMUNICATION ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────┘

CLIENT (Browser)                    SERVER (Socket.io)

    │                                     │
    │─ join-execution ──────────────────▶│
    │   { executionId }                   │
    │                          ┌─────────┐│
    │                          │ Join    ││
    │                          │ room    ││
    │                          └─────────┘│
    │                                     │
    │◀─ execution-log ──────────────────│
    │   { message, level, timestamp }    │
    │                                    │
    │◀─ execution-log ──────────────────│
    │   { message, level, timestamp }    │
    │                                    │
    │◀─ execution-status ───────────────│
    │   { status, stdout, stderr,        │
    │     exitCode }                     │
    │                                    │
    │─ leave-execution ─────────────────▶│
    │   { executionId }                  │
    │                          ┌─────────┐│
    │                          │ Leave   ││
    │                          │ room    ││
    │                          └─────────┘│

Sessions (Parallel):

    │─ join-session ────────────────────▶│
    │   { sessionId }                    │
    │                                    │
    │◀─ challenge-changed ──────────────│
    │   { challengeId }                  │
    │                                    │
    │◀─ session-status ─────────────────│
    │   { status }                       │
```

---

## 📈 Sequência de uma Entrevista Completa

```
┌──────────────────────────────────────────────────────────────────┐
│          COMPLETE INTERVIEW SESSION FLOW                          │
└──────────────────────────────────────────────────────────────────┘

STEP 1: Interviewer Setup
───────────────────────────
  Interviewer │ POST /auth/register { role: 'interviewer' }
              │ POST /auth/login
              │ POST /challenges { challenge data }
              │ GET  /challenges ← View all challenges created

STEP 2: Candidate Setup
──────────────────────────
  Interviewee │ POST /auth/register { role: 'interviewee' }
              │ POST /auth/login
              │ GET  /challenges ← View available challenges

STEP 3: Create Session
────────────────────────
  Interviewer │ POST /sessions { intervieweeId, challengeId }
              │       ▶ Session created with status: pending
              │ GET  /sessions ← See pending sessions

STEP 4: Join Session
──────────────────────
  Interviewer │ GET /sessions/:id ← View session
              │ WS  join-session { sessionId }
              │
  Interviewee │ GET /sessions/:id ← See incoming interview request
              │ WS  join-session { sessionId }

STEP 5: Start Interview
─────────────────────────
  Interviewer │ PATCH /sessions/:id/status { status: 'active' }
              │ WS    broadcast session-status { active }

STEP 6: Submit Code
────────────────────
  Interviewee │ POST /executions {
              │        code: "print('hello')",
              │        language: 'python'
              │      }
              │ WS   join-execution { executionId }
              │
  Interviewer │ WS   receive execution-log { "Starting..." }
              │ WS   receive execution-log { "Python 3.12..." }
              │ WS   receive execution-log { "Output: hello" }
              │ WS   receive execution-status { completed }

STEP 7: Review & Feedback
──────────────────────────
  Interviewer │ GET /executions/session/:id ← See all submissions
              │ PATCH /sessions/:id/challenge ← Move to next challenge
              │ WS    broadcast challenge-changed { newChallengeId }

STEP 8: Complete Interview
────────────────────────────
  Interviewer │ PATCH /sessions/:id/status { status: 'completed' }
              │ WS    broadcast session-status { completed }
              │ GET  /sessions/:id ← Session archive
```

---

## 🔐 Security Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              SECURITY LAYERS & MECHANISMS                         │
└──────────────────────────────────────────────────────────────────┘

LAYER 1: Transport Security
───────────────────────────
  ✓ HTTPS/WSS (in production)
  ✓ CORS policy configured

LAYER 2: Authentication
────────────────────────
  POST /auth/register ─┐
                       ├─▶ Password Hash (bcryptjs 10 rounds)
  POST /auth/login ────┘   JWT Sign (RS256 in production)
                          Store in localStorage

LAYER 3: Authorization
───────────────────────
  Request ─┐
           ├─▶ Extract JWT from header
           ├─▶ Verify signature & expiration
  Middleware◀─ Attach userId & userRole
           ├─▶ Check role for protected routes
  Grant Access

LAYER 4: Data Layer
───────────────────
  Query ──┐
          ├─▶ Parameterized queries (SQL injection prevention)
  Database◀─ Row-level security via userId/role checks
          ├─▶ Foreign key constraints
          └─▶ Unique constraints (email)

LAYER 5: Application Layer
───────────────────────────
  ✓ Input validation (Joi)
  ✓ Error messages don't leak info
  ✓ Rate limiting ready
  ✓ CORS allow-list
  ✓ Timeout enforcement (30s)
```

---

## 📊 API Response Patterns

```
┌──────────────────────────────────────────────────────────────────┐
│              STANDARDIZED RESPONSE FORMAT                         │
└──────────────────────────────────────────────────────────────────┘

SUCCESS (200, 201, 204)
───────────────────────
  {
    "data": { ... },           ← Resource data
    "meta": { ... }            ← Optional metadata
  }

SUCCESS (202 - Accepted)
────────────────────────
  {
    "execution": { ... },      ← Created async resource
    "message": "Accepted for processing"
  }

ERROR (4xx, 5xx)
─────────────────
  {
    "error": "User not found",
    "statusCode": 404,
    "timestamp": "2025-01-03T12:00:00Z"
  }

VALIDATION ERROR (400)
──────────────────────
  {
    "error": "Validation failed",
    "details": {
      "email": "Invalid email format",
      "password": "Must be at least 8 characters"
    }
  }
```

---

Diagrama completo da arquitetura do SourceRank Interview Platform.
