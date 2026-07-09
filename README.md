# SourceRank — Plataforma de Entrevistas Técnicas

Plataforma web para entrevistas técnicas com editor de código compartilhado em tempo real, execução de código multi-linguagem e sincronização via CRDT.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 20 + TypeScript + Express + Socket.io |
| Banco | PostgreSQL 16 |
| Frontend | React 19 + Vite + Monaco Editor + xterm.js |
| Sync | Yjs CRDT (yjs-relay) + TanStack Query |
| Runner | Node.js isolado (Python, Java, Go, JS, TS, C#) |
| Infra | Docker Compose |

## Iniciar

```bash
docker compose up --build
```

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/health |

**Usuários de teste** (criados automaticamente):
- `interviewer@test.com` / `password123`
- `candidate@test.com` / `password123`

## Fluxo básico

1. Entrevistador faz login → cria sessão → recebe código de 8 caracteres
2. Candidato faz login → digita o código → aguarda aprovação
3. Entrevistador aprova → candidato é redirecionado para a sessão
4. Ambos editam código no mesmo editor (sincronizado via Yjs)
5. Candidato executa o código → logs aparecem para os dois em tempo real
6. Entrevistador navega entre desafios → candidato acompanha automaticamente

## Documentação

- **[CLAUDE.md](CLAUDE.md)** — guia completo para desenvolvimento (rotas, schema, padrões, armadilhas)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — diagramas de componentes e fluxos
- **[API_EXAMPLES.md](API_EXAMPLES.md)** — exemplos curl de todos os endpoints

## Estrutura do projeto

```
sourcerank/
├── api/         # Backend (porta 4000) — servidor real em api/src/server.ts
├── runner/      # Executor de código (porta 3001) — servidor real em runner/src/server.ts
├── web/         # Frontend (porta 5173)
├── yjs-relay/   # Relay CRDT interno (porta 1234)
└── docker-compose.yml
```

> `api/index.js` e `runner/index.js` na raiz são código **legado** e não são executados.

## Linguagens suportadas

Python 3.12 · JavaScript (Node 20) · TypeScript · Java 21 · Go 1.25.5 · C# (Mono)
