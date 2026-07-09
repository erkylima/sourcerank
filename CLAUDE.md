# CLAUDE.md — Guia de Desenvolvimento SourceRank

Este arquivo orienta LLMs (e humanos) a entender e evoluir o projeto corretamente.

---

## O que é o SourceRank

Plataforma de entrevistas técnicas em tempo real. Dois usuários (entrevistador e candidato) compartilham um editor de código sincronizado, com execução de código multi-linguagem e logs em tempo real.

**Tecnologias principais:**
- Backend: Node.js 20 + TypeScript + Express + Socket.io + PostgreSQL 16
- Frontend: React 19 + Vite + Monaco Editor + xterm.js + TanStack Query + Zustand
- Runner: Node.js isolado que executa código em Python, Java, Go, JS, TS, C#
- CRDT Relay: Yjs via WebSocket para sincronização de código em tempo real
- Infra: Docker Compose

---

## Estrutura de diretórios

```
sourcerank/
├── api/           # Backend Express (porta 4000)
│   └── src/
│       ├── config/         # DB pool, env vars
│       ├── middlewares/    # auth JWT, error handler
│       ├── modules/        # auth, challenges, sessions, execution, crdt, session-content
│       └── websocket/      # Socket.io gateway, Yjs proxy
├── runner/        # Executor de código (porta 3001)
│   └── src/
│       └── executors/      # python, java, go, node, csharp
├── web/           # Frontend React (porta 5173)
│   └── src/
│       ├── components/     # CodeEditor, ExecutionTerminal, ChallengeView, etc.
│       ├── context/        # AuthContext, SessionContext
│       ├── hooks/          # useChallengeContent (TanStack Query + CRDT)
│       ├── pages/          # Login, InterviewSession, IntervieweeView, CreateSession, JoinSession
│       ├── repositories/   # HybridContentRepository (DB + CRDT)
│       └── services/       # api.ts, auth.service, execution.service, crdt-sync.service
├── yjs-relay/     # Servidor Yjs CRDT (porta 1234, interno)
└── docker-compose.yml
```

---

## Como rodar

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/health

Usuários de teste criados automaticamente no seed:
- `interviewer@test.com` / `password123` (role: interviewer)
- `candidate@test.com` / `password123` (role: interviewee)

---

## Rotas da API (rotas reais — não confundir com legado)

O arquivo `api/index.js` na raiz é **código legado** e **não é usado**. O servidor real é `api/src/server.ts`.

### Auth — `/auth`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/register` | — | Registrar usuário |
| POST | `/auth/login` | — | Login, retorna `{ user, token }` |
| GET | `/auth/me` | JWT | Usuário logado |

### Challenges — `/challenges`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/challenges` | — | Listar (paginado: `?limit=&offset=`) |
| GET | `/challenges/:id` | — | Buscar por ID |
| POST | `/challenges` | JWT + interviewer | Criar |
| PUT | `/challenges/:id` | JWT + interviewer | Atualizar |
| DELETE | `/challenges/:id` | JWT + interviewer | Deletar |
| GET | `/challenges/:id/examples` | — | Casos de teste (`?limit=`) |
| GET | `/challenges/:id/evaluate` | — | Avaliar código do candidato (`?sessionId=`) |

### Sessions — `/sessions`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/sessions/create-interview` | JWT | Entrevistador cria sessão (sem challenge) |
| POST | `/sessions/request-access` | JWT | Candidato entra com `{ sessionCode }` |
| GET | `/sessions/:id` | JWT | Buscar sessão |
| GET | `/sessions` | JWT | Listar sessões do usuário |
| PATCH | `/sessions/:id/accept` | JWT | Entrevistador aceita candidato |
| PATCH | `/sessions/:id/reject` | JWT | Entrevistador rejeita candidato |
| PATCH | `/sessions/:id/end` | JWT | Encerrar sessão |
| PATCH | `/sessions/:id/status` | JWT | Atualizar status |
| PATCH | `/sessions/:id/challenge` | JWT | Mudar desafio atual (`{ challengeId }`) |
| POST | `/sessions` | JWT | Criar sessão com interviewee e challenge já definidos |

### Executions — `/executions`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/executions` | JWT | Submeter código (`{ sessionId, challengeId, language, code }`) |
| GET | `/executions/:id` | JWT | Buscar execução |
| GET | `/executions/:id/logs` | JWT | Logs da execução |
| GET | `/executions/session/:sessionId` | JWT | Todas execuções da sessão |
| POST | `/executions/:id/report` | — | Callback do Runner (sem auth) |
| POST | `/executions/:executionId/logs` | — | Runner envia log (sem auth) |

### Session Content — `/session-content`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/:sessionId/challenges/:challengeId` | JWT | Buscar conteúdo (`?contentType=&language=`) |
| POST | `/:sessionId/challenges/:challengeId` | JWT | Salvar conteúdo |
| GET | `/:sessionId/challenges/:challengeId/preferred-language` | JWT | Linguagem preferida por challenge |
| POST | `/:sessionId/challenges/:challengeId/change-language` | JWT | Trocar linguagem (move para histórico) |
| GET | `/:sessionId/challenges/:challengeId/languages` | JWT | Histórico de linguagens |
| GET | `/sessions/:sessionId/preferred-language` | JWT | Linguagem preferida da sessão |
| PATCH | `/sessions/:sessionId/preferred-language` | JWT | Salvar linguagem preferida |

### Content Persist — `/content`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/content/persist` | JWT | Persistir conteúdo com histórico opcional |
| POST | `/content/persist-and-switch` | JWT | Persiste e registra troca de linguagem/challenge |

### CRDT / Relay — `/crdt`, `/relay`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/crdt/snapshot` | JWT | Força save de snapshot |
| GET | `/relay/state` | — | Polling de mudanças do relay Yjs |
| POST | `/relay/snapshot` | — | Força snapshot no relay |

### WebSocket (Socket.io)
Porta 4000, path padrão. Eventos:
- `join-session` / `leave-session` — entrar na sala da sessão
- `join-execution` / `leave-execution` — receber logs de uma execução
- `join-room` / `leave-room` — salas genéricas (ex: `interviewer:{userId}`)
- `session-challenge-changed-{sessionId}` — broadcast de navegação
- `session-language-changed-{sessionId}` — broadcast de troca de linguagem
- `session-execution-started-{sessionId}` — início de execução
- `execution-log-{executionId}` — linha de log em tempo real
- `execution-completed-{executionId}` — fim de execução
- `candidate-access-request` — candidato solicitou entrada

### WebSocket Yjs (CRDT)
Caminho `/yjs` na porta 4000 (proxy para yjs-relay:1234). Parâmetros de query:
`?sessionId=&challengeId=&contentType=&language=&token=`

---

## Banco de dados

Schema gerenciado por `api/src/config/database.ts` no `initializeDatabase()`.

### Tabelas principais

**users** — `id UUID PK`, `email UNIQUE`, `password_hash`, `role` (interviewer|interviewee), `name`

**challenges** — `id SERIAL PK` (inteiro, não UUID), `title`, `description`, `difficulty` (basic|intermediate|advanced), `code_example`, `lang_example`, `created_by FK users`

**challenges_evaluations** — `id SERIAL PK`, `challenge_id FK`, `input_example`, `expected_output`

**sessions** — `id UUID PK`, `interviewer_id FK`, `interviewee_id FK nullable`, `current_challenge_id FK nullable`, `preferred_language`, `status` (pending|active|completed|cancelled|expired), `session_code VARCHAR(20)`, `interviewee_accepted BOOLEAN`, `expires_at`

**executions** — `id UUID PK`, `session_id FK`, `language`, `code`, `status` (pending|running|completed|error), `output`, `error`, `execution_time_ms`

**logs** — `id UUID PK`, `execution_id FK`, `message`, `level` (info|error|warning)

**session_challenge_content** — `id UUID PK`, `session_id FK`, `challenge_id FK`, `content_type` (code|notes), `language`, `content`, `started BOOLEAN`. Constraint UNIQUE em `(session_id, challenge_id, content_type)`.

**session_challenge_content_history** — mesmos campos sem constraint UNIQUE. Armazena versões anteriores quando linguagem muda.

**starter_codes** — `language UNIQUE`, `content`. Templates genéricos por linguagem (não por challenge).

> **Atenção:** `challenges.id` é `SERIAL` (inteiro), não UUID. Código que trata isso como string pode falhar em comparações de tipo.

---

## Fluxo de uma entrevista

```
1. Entrevistador faz login → POST /auth/login
2. Entrevistador cria sessão → POST /sessions/create-interview
   └─ Recebe session_code (primeiros 8 chars do UUID em maiúsculas)
3. Candidato faz login → POST /auth/login
4. Candidato solicita acesso → POST /sessions/request-access { sessionCode }
   └─ Backend emite 'candidate-access-request' via Socket para o entrevistador
5. Entrevistador aceita → PATCH /sessions/:id/accept
   └─ Seta interviewee_accepted=true, status='active'
6. Candidato faz polling em GET /sessions/:id
   └─ Quando interviewee_accepted=true → redireciona para /interview-session/:id
7. Ambos entram na sessão → join-session via Socket.io
8. Candidato edita código → CRDT Yjs sincroniza em tempo real
9. Candidato executa → POST /executions
   └─ API → Runner via HTTP
   └─ Runner → API via POST /executions/:id/logs (cada linha)
   └─ API → Socket 'execution-log-{id}' para ambos
   └─ Runner → API via POST /executions/:id/report (resultado final)
10. Entrevistador navega desafios → PATCH /sessions/:id/challenge
    └─ Socket emite 'session-challenge-changed-{sessionId}' para o candidato
```

---

## Sincronização de código (CRDT)

O editor usa `useChallengeContent` hook que combina:
1. **TanStack Query** — carrega conteúdo inicial do banco via `/session-content`
2. **Yjs CRDT** via `crdt-sync.service.ts` — sincroniza edições em tempo real

O relay Yjs (`yjs-relay/server.js`) mantém o estado em memória e persiste snapshots localmente em `/tmp/yjs-snapshots`. O `polling.service.ts` do backend faz poll no relay a cada 5s e persiste no PostgreSQL.

**Importante:** ao trocar de linguagem, o conteúdo atual vai para `session_challenge_content_history` e o conteúdo da nova linguagem é carregado (do histórico ou starter). Isso é feito em `POST /session-content/:sessionId/challenges/:challengeId/change-language`.

---

## Runner

Executa código de forma assíncrona:
1. Recebe `POST /execute` com `{ executionId, language, code, input?, timeout? }`
2. Cria diretório temporário em `/tmp/executions/{executionId}`
3. Executa via executor específico da linguagem
4. Cada linha de stdout/stderr → `POST {API_URL}/executions/{executionId}/logs`
5. Ao finalizar → `POST {API_URL}/executions/{executionId}/report`
6. Limpa o diretório temporário

Linguagens suportadas: `python`, `javascript`, `typescript`, `java`, `go`, `csharp`.

---

## Padrões de código

### Backend
- Arquitetura modular: cada módulo tem `.types.ts`, `.service.ts`, `.controller.ts`, `.routes.ts`
- TypeScript strict (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`)
- Erros HTTP via classes em `api/src/utils/errors.ts`
- Queries SQL sempre parametrizadas (`query('SELECT ... WHERE id = $1', [id])`)
- Autenticação via `authenticateToken` middleware; autorização via `requireRole(['interviewer'])`

### Frontend
- Estado de servidor: TanStack Query (`useQuery`, staleTime: Infinity por causa do CRDT)
- Estado global de UI: Zustand (`useUIStore`)
- Estado de auth: React Context (`AuthContext`)
- Componente principal da entrevista: `InterviewPage` — usado tanto pelo `InterviewSession` (entrevistador) quanto pelo `IntervieweeView` (candidato), passando prop `role`
- Serviço de API: `web/src/services/api.ts` — instância axios centralizada

---

## Arquivos legados (não modificar)

- `api/index.js` — servidor legado com endpoints diferentes. Não é usado. O servidor real é `api/src/server.ts`.
- `runner/index.js` — runner legado baseado em Socket.io. Não é usado. O runner real é `runner/src/server.ts`.

---

## Pontos de atenção ao desenvolver

1. **`challenges.id` é inteiro** (`SERIAL`), não UUID. Cuidado ao passar como string em queries SQL ou comparações TypeScript.

2. **Constraint UNIQUE em session_challenge_content** é em `(session_id, challenge_id, content_type)` — não inclui `language`. Ao trocar de linguagem, o conteúdo anterior é movido para history antes de atualizar.

3. **O `session_code`** são os primeiros 8 caracteres do UUID da sessão em maiúsculas. A busca por código usa `id::text ILIKE '${code}%'`.

4. **Rotas de `/session-content`** têm dois sub-padrões que conflitam se a ordem importa: `/:sessionId/challenges/:challengeId` e `/sessions/:sessionId/preferred-language`. A rota `/sessions/...` deve vir antes de `/:sessionId/...` no router (já está assim em `session-content.routes.ts`).

5. **O polling service** (`polling.service.ts`) itera sobre todas as sessões ativas × todos os challenges × todas as linguagens. É custoso. Em produção, substituir por evento-driven.

6. **Yjs relay** não tem autenticação nas rotas HTTP (`/snapshot`, `/relay/state`) — apenas nas conexões WebSocket. Essas rotas são internas (só acessadas pelo container `api`).

7. **`migration_language_history.sql`** altera a UNIQUE constraint de `session_challenge_content` para incluir `language`. Isso conflita com a constraint em `database.ts`. Verificar se foi aplicada antes de alterar.

---

## Tarefas pendentes conhecidas

- [ ] Sandboxing real no runner (seccomp/cgroups) — atualmente só diretório temporário
- [ ] Rate limiting nos endpoints
- [ ] O `polling.service.ts` é ineficiente — deveria usar pub/sub ou webhook do relay
- [ ] `challenges_evaluations` usa `input_example` como string plana; o executor usa `input` como stdin — funciona para casos simples mas não para todos os formatos
- [ ] Rota legada `POST /executions/run` (alias de `/executions`) pode ser removida
- [ ] `migration_language_history.sql` e `migration_content_history.sql` precisam ser integrados ao `initializeDatabase()` ou ao sistema de migrations
