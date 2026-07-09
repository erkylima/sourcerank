# Arquitetura — SourceRank

## Visão geral dos serviços

```
Browser (Entrevistador / Candidato)
    │
    ├── HTTP REST ──────────────────────────────────────────────────┐
    ├── Socket.io (ws://:4000) ─────────────────────────────────────┤
    └── Yjs WebSocket (ws://:4000/yjs) ──────────────────────────── ┤
                                                                     │
                                                    ┌────────────────▼──────────────────┐
                                                    │     API (api/src/server.ts)       │
                                                    │     Express + Socket.io           │
                                                    │     porta 4000                    │
                                                    └─────┬──────────────────┬──────────┘
                                                          │                  │
                                              ┌───────────▼──┐    ┌─────────▼──────────┐
                                              │  PostgreSQL  │    │  yjs-relay          │
                                              │  porta 5432  │    │  (interno :1234)    │
                                              └──────────────┘    └────────────────────┘
                                                          │
                                              ┌───────────▼──────────┐
                                              │  Runner               │
                                              │  (runner/src/server)  │
                                              │  porta 3001           │
                                              └──────────────────────┘
```

## Módulos do backend

```
api/src/
├── config/
│   ├── database.ts       # Pool pg, initializeDatabase(), seed
│   └── env.ts            # Variáveis de ambiente tipadas
├── middlewares/
│   └── auth.middleware.ts # authenticateToken, requireRole
├── modules/
│   ├── auth/             # register, login, me
│   ├── challenges/       # CRUD + evaluate + examples
│   ├── sessions/         # create-interview, request-access, accept, reject, end
│   ├── execution/        # submit, report (callback do runner), logs
│   ├── session-content/  # conteúdo do editor por sessão/challenge/linguagem
│   │   ├── content-history.service.ts  # histórico ao trocar linguagem
│   │   └── language.service.ts         # lógica de troca de linguagem
│   └── crdt/
│       ├── relay.controller.ts   # proxy HTTP para yjs-relay
│       ├── relay.routes.ts       # GET /relay/state, POST /relay/snapshot
│       └── polling.service.ts    # persiste CRDT → DB a cada 5s
├── websocket/
│   ├── execution.gateway.ts   # Socket.io: salas, broadcasts, notificações
│   └── yjs-proxy.gateway.ts   # Proxy WebSocket /yjs → yjs-relay:1234
└── utils/
    └── errors.ts   # AppError, ValidationError, AuthenticationError, etc.
```

## Fluxo de execução de código

```
Candidato clica "Executar"
    │
    ▼
POST /executions { sessionId, challengeId, language, code }
    │
    ├── Cria registro em executions (status: pending)
    ├── Emite 'session-execution-started-{sessionId}' via Socket
    │   └─ Ambos os clientes recebem e fazem join-execution
    │
    ▼
POST http://runner:3001/execute { executionId, language, code, input? }
    │
    ▼
Runner executa código em /tmp/executions/{executionId}/
    │
    ├── Por linha de output → POST /executions/{id}/logs { message, level }
    │   └─ API → broadcastLog → Socket 'execution-log-{id}' para sala
    │
    └── Ao finalizar → POST /executions/{id}/report { status, stdout, stderr, exitCode }
        └─ API emite 'execution-completed-{id}' e 'session-execution-completed-{sessionId}'
```

## Fluxo de sincronização CRDT

```
Usuário digita no CodeEditor
    │
    ▼
useChallengeContent.updateContent(value)
    │
    ├── setSyncedContent(value)           # atualiza estado local
    └── repository.publish(...)           # publica no Yjs
            │
            ▼
        crdt-sync.service.ts
            └── Y.Doc.transact()         # atualiza o doc local
                    │
                    └── doc.on('update') → ws.send(update) → yjs-relay
                            │
                            └── yjs-relay → broadcast para outros clientes
                                    │
                                    └── clientes recebem → Y.applyUpdate()
                                            │
                                            └── ytext.observe() → setSyncedContent()
                                                    │
                                                    └── CodeEditor re-renderiza

Em paralelo, polling.service.ts (a cada 5s):
    GET yjs-relay/relay/state → se mudou → salva no PostgreSQL
```

## Fluxo de entrada na sessão (candidato)

```
POST /sessions/request-access { sessionCode }
    │
    ├── Atualiza sessions.interviewee_id
    └── Socket: notifyInterviewerOfAccessRequest → 'candidate-access-request'
            │
            └── Tela CreateSession recebe via Socket.io

PATCH /sessions/:id/accept
    ├── interviewee_accepted = true
    └── status = 'active'

Candidato faz polling GET /sessions/:id (a cada 2s em JoinSession.tsx)
    └── Quando interviewee_accepted === true → navigate('/interview-session/:id')
```

## Schema do banco de dados

```
users ──────────────────────────────────────────────────────────────────────────
  id UUID PK · email UNIQUE · password_hash · role(interviewer|interviewee) · name

challenges ─────────────────────────────────────────────────────────────────────
  id SERIAL PK · title · description · difficulty(basic|intermediate|advanced)
  code_example · lang_example · created_by FK→users

challenges_evaluations ─────────────────────────────────────────────────────────
  id SERIAL PK · challenge_id FK→challenges · input_example · expected_output

sessions ───────────────────────────────────────────────────────────────────────
  id UUID PK · interviewer_id FK→users · interviewee_id FK→users nullable
  current_challenge_id FK→challenges nullable · preferred_language
  status(pending|active|completed|cancelled|expired)
  session_code VARCHAR(20) · interviewee_accepted BOOL · expires_at

executions ─────────────────────────────────────────────────────────────────────
  id UUID PK · session_id FK→sessions · language · code
  status(pending|running|completed|error) · output · error · execution_time_ms

logs ───────────────────────────────────────────────────────────────────────────
  id UUID PK · execution_id FK→executions · message · level(info|error|warning)

session_challenge_content ──────────────────────────────────────────────────────
  id UUID PK · session_id FK · challenge_id FK · content_type(code|notes)
  language · content · started BOOL
  UNIQUE(session_id, challenge_id, content_type)   ← apenas um por combinação

session_challenge_content_history ─────────────────────────────────────────────
  id UUID PK · session_id FK · challenge_id FK · content_type
  language · content                               ← sem UNIQUE, armazena histórico

starter_codes ──────────────────────────────────────────────────────────────────
  id UUID PK · language UNIQUE · content           ← template genérico por linguagem
```

## Componentes do frontend

```
App.tsx
├── AuthProvider (context)
├── SessionProvider (context)
└── Routes
    ├── /login              → Login.tsx
    ├── /create-session     → CreateSession.tsx (interviewer)
    ├── /join-session       → JoinSession.tsx (interviewee)
    └── /interview-session/:id → InterviewSession.tsx | IntervieweeView.tsx
                                    └── InterviewPage.tsx (role='interviewer'|'interviewee')
                                            ├── ChallengeNavigator (sidebar)
                                            ├── CodeEditor
                                            │     ├── useChallengeContent (hook)
                                            │     │     ├── TanStack Query → DB
                                            │     │     └── Yjs CRDT → real-time
                                            │     └── EditorSyncController (Monaco ↔ CRDT)
                                            ├── ChallengeView
                                            └── ExecutionTerminal (xterm.js)
```
