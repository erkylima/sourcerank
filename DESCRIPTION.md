# SourceRank - Plataforma de Entrevistas Técnicas em Tempo Real

## 📖 Descrição Completa

**SourceRank** é uma plataforma web completa e robusta para conduzir entrevistas técnicas com sincronização em tempo real entre entrevistador e candidato. Permite que ambos colaborem simultaneamente em um editor de código compartilhado, com suporte a múltiplas linguagens de programação, execução instantânea de código e logs em tempo real.

### Objetivo Principal

Fornecer uma experiência profissional e confiável para entrevistas técnicas remotas, eliminando friction points como:
- Necessidade de compartilhar tela
- Latência na sincronização de código
- Falta de feedback imediato
- Dificuldade em trocar linguagens
- Logs de execução desincronizados

---

## 🎯 Funcionalidades Principais

### Para o Entrevistador
- ✅ Criar e editar desafios de programação com exemplos de entrada/saída
- ✅ Gerenciar múltiplas sessões de entrevista simultâneas
- ✅ Navegar entre desafios (Próximo/Anterior) com sincronização automática
- ✅ Visualizar código do candidato em tempo real
- ✅ Monitorar execução de código com logs instantâneos
- ✅ Trocar linguagem de programação e ver starter code atualizado instantaneamente
- ✅ Compartilhar link único da sessão com candidato

### Para o Candidato
- ✅ Visualizar desafios sequenciais com descrição e exemplos
- ✅ Editar código com syntax highlighting profissional (Monaco Editor)
- ✅ Trocar linguagem de programação sem perder progresso
- ✅ Executar código e ver logs de saída em tempo real
- ✅ Navegar entre desafios sincronizado com entrevistador
- ✅ Receber atualizações automáticas de linguagem e desafio
- ✅ Recuperar código anterior após recarregamento da página

### Sincronização em Tempo Real
- ✅ **Código**: Ambos veem o mesmo código simultaneamente
- ✅ **Linguagem**: Troca de linguagem é atômica (sem piscar/flicker)
- ✅ **Desafios**: Navegação sincronizada entre entrevistador e candidato
- ✅ **Execução**: Logs aparecem em ambas as abas sem duplicação
- ✅ **Broadcast Deduplicado**: Sem race conditions ou mensagens duplicadas

---

## 🏗️ Arquitetura Técnica

### Stack de Tecnologias

#### Backend (API)
| Componente | Tecnologia | Versão |
|-----------|-----------|--------|
| Runtime | Node.js | 20 |
| Language | TypeScript | 5.3+ |
| Framework Web | Express.js | 4.18+ |
| WebSocket | Socket.io | 4.5+ |
| Database | PostgreSQL | 16 |
| Authentication | JWT | - |
| Container | Docker | 24+ |

#### Frontend (Web)
| Componente | Tecnologia | Versão |
|-----------|-----------|--------|
| Framework | React | 19 |
| Language | TypeScript | 5.3+ |
| Bundler | Vite | 5 |
| Code Editor | Monaco Editor | latest |
| Terminal | xterm.js | 5.3+ |
| HTTP Client | Axios | 1.6+ |
| WebSocket | Socket.io Client | 4.5+ |
| State Management | Zustand | 4.4+ |
| Query Management | TanStack Query | 5+ |

#### Code Execution (Runner)
| Linguagem | Versão | Executor |
|-----------|--------|----------|
| Python | 3.12 | `python3` |
| JavaScript | Node 20 | `node` |
| TypeScript | latest | `ts-node` |
| Java | 21 | `javac` + `java` |
| Go | 1.25.5 | `go run` |
| C# | Mono | `mcs` + `mono` |

### Arquitetura de Serviços

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Login → InterviewerSession | IntervieweeView           │   │
│  │  Components: CodeEditor (Monaco), ExecutionTerminal    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────┬──────────────────────────┬────────────────────┘
                  │ WebSocket (Socket.io)    │ HTTP REST
                  │                          │
        ┌─────────▼──────────────────────────▼─────────┐
        │         API GATEWAY (Express + Socket.io)     │
        │  ┌────────────────────────────────────────┐   │
        │  │ Routes:                                │   │
        │  │ • /auth/* (Login/Register)             │   │
        │  │ • /challenges/* (CRUD)                 │   │
        │  │ • /sessions/* (Session Management)     │   │
        │  │ • /run (Code Execution)                │   │
        │  │ • /content/persist (Save Content)      │   │
        │  └────────────────────────────────────────┘   │
        │  ┌────────────────────────────────────────┐   │
        │  │ WebSocket Events:                      │   │
        │  │ • session-code-changed                 │   │
        │  │ • session-challenge-changed            │   │
        │  │ • session-language-changed             │   │
        │  │ • session-execution-started            │   │
        │  │ • execution-log-{executionId}          │   │
        │  └────────────────────────────────────────┘   │
        └───────────┬──────────────────────┬────────────┘
                    │                      │
         ┌──────────▼──────────┐  ┌───────▼─────────────┐
         │   PostgreSQL 16     │  │   Code Runner       │
         │   (Database)        │  │   (Docker)          │
         │                     │  │                     │
         │ Tables:             │  │ • Python Executor   │
         │ • users             │  │ • JavaScript Engine │
         │ • challenges        │  │ • Java Compiler     │
         │ • sessions          │  │ • Go Runner         │
         │ • executions        │  │ • TypeScript Runner │
         │ • logs              │  │ • C# Compiler       │
         │ • session_content   │  │                     │
         │ • starter_codes     │  └─────────────────────┘
         │ • content_history   │
         └─────────────────────┘
```

### Fluxo de Dados

#### 1. **Sincronização de Código**
```
Candidato digita
    ↓
CodeEditor onChange → InterviewPage.handleCodeChange()
    ↓
currentCodeRef.current = novo código
    ↓
Socket emit: 'session-code-changed-{sessionId}'
    ↓
Backend: socket.onAny() → broadcast para outros clientes
    ↓
Entrevistador recebe update → CodeEditor re-renderiza
    ↓
API.persistContent() salva no banco (debounced 2s)
```

#### 2. **Troca de Linguagem**
```
Candidato seleciona nova linguagem
    ↓
handleLanguageChange() executado atomicamente:
  • setLanguage(newLanguage)
  • Busca starter code para novo idioma
  • Limpa histórico de código
    ↓
Socket emit: 'session-language-changed-{sessionId}'
    ↓
Backend broadcast para entrevistador
    ↓
apiService.updatePreferredLanguage() salva preferência
    ↓
Ambos veem novo starter code sem piscar
```

#### 3. **Execução de Código**
```
Candidato clica "Executar"
    ↓
apiService.runCode(language, code, sessionId, challengeId)
    ↓
Backend cria Execution record → envia para Runner via Socket
    ↓
Runner executa código → emite logs por Socket
    ↓
Socket: 'execution-log-{executionId}' recebido
    ↓
setLogs(prev => prev + message) atualiza terminal
    ↓
Socket: 'execution-completed-{executionId}' finaliza
    ↓
Ambos veem mesmo output, sem duplicação
```

### Estrutura de Banco de Dados

#### Tabelas Principais

**users**
- id (UUID, PK)
- email, password_hash, role (interviewer|interviewee)
- name, created_at, updated_at

**challenges**
- id (SERIAL, PK)
- title, description, difficulty (basic|intermediate|advanced)
- input_example, output_example
- created_by (FK users), created_at, updated_at

**sessions**
- id (UUID, PK)
- interviewer_id (FK users), interviewee_id (FK users)
- current_challenge_id (FK challenges)
- preferred_language (python|javascript|java|go|typescript|csharp)
- status (pending|active|completed|cancelled|expired)
- session_code, interviewee_accepted, expires_at
- created_at, updated_at

**session_challenge_content**
- id (UUID, PK)
- session_id (FK sessions), challenge_id (FK challenges)
- content_type (code|notes)
- language (python|javascript|...)
- content (TEXT)
- started (BOOLEAN) - marca se usuário começou a editar
- created_at, updated_at
- UNIQUE(session_id, challenge_id, content_type)

**session_challenge_content_history**
- Armazena versões anteriores de código quando linguagem muda
- Permite recuperação após reload ou mudança de desafio
- Índices para lookup rápido por (session, challenge, language)

**starter_codes**
- Challenge specific templates por linguagem
- UNIQUE(challenge_id, language)
- Atualizado quando new challenge é criada

**executions**
- id (UUID, PK)
- session_id (FK sessions)
- language, code, status
- output, error, execution_time_ms
- created_at, updated_at

**logs**
- id (UUID, PK)
- execution_id (FK executions)
- message, level (info|error|warning)
- created_at

---

## 📂 Estrutura de Arquivos

```
sourcerank/
├── api/                              # Backend Node.js/Express
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          # Pool PostgreSQL, migrations, seeds
│   │   │   ├── env.ts               # Variáveis de ambiente
│   │   │   └── dotenv.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.service.ts
│   │   │   ├── users/
│   │   │   ├── challenges/
│   │   │   │   ├── challenges.controller.ts
│   │   │   │   ├── challenges.routes.ts
│   │   │   │   └── challenges.service.ts
│   │   │   ├── sessions/
│   │   │   │   ├── session.controller.ts
│   │   │   │   ├── session.routes.ts
│   │   │   │   └── session.service.ts
│   │   │   ├── execution/
│   │   │   │   ├── execution.controller.ts
│   │   │   │   ├── execution.routes.ts
│   │   │   │   └── execution.service.ts
│   │   │   └── session-content/
│   │   │       ├── session-content.controller.ts
│   │   │       ├── session-content.routes.ts
│   │   │       └── session-content.service.ts
│   │   ├── websocket/
│   │   │   ├── execution.gateway.ts  # Socket.io handlers
│   │   │   └── yjs-proxy.gateway.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts    # JWT verification
│   │   │   └── error.middleware.ts
│   │   ├── app.ts                    # Express app setup
│   │   └── server.ts                 # Server startup
│   ├── Dockerfile
│   └── package.json
│
├── runner/                          # Code Execution Service
│   ├── src/
│   │   ├── executors/
│   │   │   ├── python.executor.ts
│   │   │   ├── javascript.executor.ts
│   │   │   ├── java.executor.ts
│   │   │   ├── go.executor.ts
│   │   │   ├── typescript.executor.ts
│   │   │   └── csharp.executor.ts
│   │   ├── index.ts                 # Socket listener
│   │   └── config.ts
│   ├── Dockerfile                    # Multi-stage com SDKs
│   └── package.json
│
├── web/                             # Frontend React/Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx            # Auth page
│   │   │   ├── InterviewSession.tsx  # Entrevistador
│   │   │   └── IntervieweeView.tsx   # Candidato
│   │   ├── components/
│   │   │   ├── Interview/
│   │   │   │   └── InterviewPage.tsx # Componente principal (ambos roles)
│   │   │   ├── Editor/
│   │   │   │   └── CodeEditor.tsx    # Monaco wrapper
│   │   │   ├── Terminal/
│   │   │   │   └── ExecutionTerminal.tsx  # xterm.js
│   │   │   └── Challenge/
│   │   │       ├── ChallengeView.tsx
│   │   │       ├── ChallengeNavigator.tsx
│   │   │       └── ChallengeEditor.tsx
│   │   ├── hooks/
│   │   │   ├── useChallengeContent.ts  # TanStack Query hook
│   │   │   └── useCodeExecution.ts
│   │   ├── services/
│   │   │   ├── api.ts               # Axios client
│   │   │   ├── auth.service.ts      # JWT management
│   │   │   └── execution.service.ts # Socket.io wrapper
│   │   ├── stores/
│   │   │   └── useUIStore.ts        # Zustand global state
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces
│   │   ├── styles/
│   │   │   └── Interview.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── package.json
│
├── yjs-relay/                       # CRDT Relay (conteúdo compartilhado)
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml               # Orquestração de serviços
├── .env.example                     # Variáveis de ambiente template
│
├── docs/
│   ├── README.md                    # Visão geral
│   ├── QUICKSTART.md                # Guia rápido de setup
│   ├── ARCHITECTURE.md              # Detalhes de arquitetura
│   ├── PROJECT_STATUS.md            # Status completo do projeto
│   ├── API_EXAMPLES.md              # Exemplos de endpoints
│   ├── Modelagem_dados.md           # Esquema do banco de dados
│   └── DEVELOPMENT_GUIDE.md         # Para contribuições
│
└── migrations/
    └── 001_initial_schema.sql       # Schema inicial com seeds
```

---

## 🚀 Como Executar

### Pré-requisitos
- Docker 24+
- Docker Compose 2.20+
- ~2GB espaço em disco

### Startup Rápido

```bash
cd /home/erky/Documentos/desenvolvimento/projetos/sourcerank

# Build e start de todos os serviços
docker compose up --build

# Ou apenas reiniciar
docker compose restart
```

Aguarde 30-60 segundos até todos os serviços estarem prontos.

### Acesso

- **Frontend**: http://localhost:5173
- **API REST**: http://localhost:4000
- **WebSocket**: ws://localhost:4000
- **Database**: postgres://localhost:5432/sourcerank

### Credenciais de Teste

```
Email: teste@example.com
Senha: teste123
```

---

## 🔐 Segurança

### Implementado (MVP)
- ✅ JWT para autenticação
- ✅ Hash de senhas (bcrypt)
- ✅ CORS configurado
- ✅ Validação de entrada
- ✅ Rate limiting via Docker

### TODO para Produção
- [ ] Timeouts em execução (máx 10s)
- [ ] Limites de recursos (CPU, memória)
- [ ] Sandboxing (seccomp, cgroups)
- [ ] HTTPS/WSS
- [ ] Auditoria de logs
- [ ] OAuth2/SAML
- [ ] WAF (Web Application Firewall)

---

## 📊 Desafios Pré-configurados

1. **FizzBuzz** - Básico
2. **Two Sum** - Básico
3. **Reverse String** - Básico
4. **Palindrome Number** - Básico
5. **Valid Parentheses** - Intermediário
6. **Binary Search** - Intermediário
7. **Longest Substring** - Intermediário
8. **Merge K Sorted Lists** - Avançado
9. **Median of Two Sorted Arrays** - Avançado
10. **Regular Expression Matching** - Avançado

---

## 🔄 Fluxo de Uso Completo

### Entrevistador
1. Faz login
2. Cria nova sessão (seleciona desafio inicial)
3. Compartilha link com candidato
4. Monitora código em tempo real
5. Navega entre desafios
6. Muda linguagem para testar conhecimento
7. Monitora execução e logs

### Candidato
1. Recebe link da sessão
2. Faz login/aceita convite
3. Vê desafio atual
4. Edita código
5. Muda linguagem quando solicitado
6. Executa código
7. Vê logs de saída
8. Navega conforme entrevistador

### Sincronização
- Ambos sempre veem o **mesmo código**
- Ambos veem a **mesma linguagem** (troca atômica)
- Ambos navegam entre **mesmos desafios**
- Ambos veem **mesmos logs de execução** (sem duplicação)

---

## ⚡ Performance

- **Latência de sincronização**: < 100ms
- **Throughput de logs**: ~1000 linhas/segundo
- **Conexões simultâneas**: 10+ sessões
- **Tamanho máximo de código**: 1MB
- **Timeout de execução**: 30 segundos

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie branch: `git checkout -b feature/MinhaFeature`
3. Commit: `git commit -m 'Add MinhaFeature'`
4. Push: `git push origin feature/MinhaFeature`
5. Abra Pull Request

---

## 📝 Licença

MIT License

---

## 👨‍💻 Status do Projeto

**Versão**: 1.0.0  
**Status**: ✅ Funcionando (MVP)  
**Última atualização**: 8 de janeiro de 2026  
**Autor**: SourceRank Team

### Checklist de Funcionalidades
- ✅ Autenticação (JWT)
- ✅ Gerenciamento de desafios
- ✅ Editor de código (Monaco)
- ✅ Terminal interativo (xterm)
- ✅ Sincronização em tempo real
- ✅ Suporte a 6 linguagens
- ✅ Execução de código
- ✅ Persistência de progresso
- ✅ Histórico de conteúdo
- ✅ Logs sincronizados
- ⚠️ Segurança avançada (TODO)
- ⚠️ Análise de performance (TODO)

---

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verifique [QUICKSTART.md](./QUICKSTART.md)
2. Consulte [API_EXAMPLES.md](./API_EXAMPLES.md)
3. Veja [ARCHITECTURE.md](./ARCHITECTURE.md)
4. Leia [PROJECT_STATUS.md](./PROJECT_STATUS.md)
