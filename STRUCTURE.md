# Estrutura do Projeto SourceRank

## 📦 Projeto Completo

```
sourcerank/
├── 📋 README.md                 ← LEIA PRIMEIRO
├── DEPLOYMENT.md                ← Guia de produção
├── DEVELOPMENT.md               ← Guia de desenvolvimento
├── STRUCTURE.md                 ← Este arquivo
├── .gitignore
├── start.sh                     ← Script de inicialização
└── docker-compose.yml           ← Orquestração Docker
    
├── 🔷 api/                      ← Backend Express + Socket.io
│   ├── index.js                 ← Servidor principal
│   ├── challenges.json          ← Desafios (editável)
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── 🏃 runner/                   ← Executor de código
│   ├── index.js                 ← Worker que executa código
│   ├── package.json
│   └── Dockerfile               ← SDKs: Python, Java, Go, Node, C#
│
└── 🎨 web/                      ← Frontend React + TypeScript
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── Dockerfile
    ├── .env.example
    │
    └── src/
        ├── main.tsx             ← Entry point
        ├── App.tsx              ← Router principal
        │
        ├── components/          ← Componentes reutilizáveis
        │   ├── Editor/
        │   │   └── CodeEditor.tsx          ← Monaco Editor
        │   ├── Terminal/
        │   │   └── ExecutionTerminal.tsx   ← xterm.js
        │   ├── Challenge/
        │   │   ├── ChallengeView.tsx       ← Visualiza desafio
        │   │   └── ChallengeNavigator.tsx  ← Navegação desafios
        │   └── Layout/
        │
        ├── pages/               ← Telas principais
        │   ├── Login.tsx
        │   ├── InterviewerDashboard.tsx
        │   ├── InterviewSession.tsx
        │   └── IntervieweeView.tsx
        │
        ├── context/             ← React Context para estado global
        │   ├── AuthContext.tsx              ← Autenticação + JWT
        │   └── SessionContext.tsx           ← Navegação de desafios
        │
        ├── services/            ← Lógica de integração
        │   ├── api.ts                      ← Axios + endpoints
        │   ├── auth.service.ts             ← JWT + localStorage
        │   └── execution.service.ts        ← Socket.io client
        │
        ├── styles/              ← CSS (Design Flat 2.0)
        │   ├── global.css
        │   ├── Login.css
        │   ├── Dashboard.css
        │   ├── Interview.css
        │   ├── Challenge.css
        │   ├── Editor.css
        │   └── Terminal.css
        │
        ├── types/               ← Tipos TypeScript
        │   └── index.ts
        │
        ├── hooks/               ← React Hooks customizados
        │
        └── assets/              ← Imagens, ícones, etc
```

## 🔄 Fluxo de Dados

```
┌─────────────────┐
│  Interviewee    │
└────────┬────────┘
         │
         │ (1) fetch /challenges
         ▼
┌─────────────────────────────────┐
│  Frontend (React)               │
│ - Display Challenge             │
│ - Editor Monaco                 │
│ - Terminal xterm               │
└──┬──────────────┬───────────────┘
   │              │
   │ (2)          │ (3) POST /run
   │ Socket.io    │ + join-session
   │ (logs)       │
   │              ▼
   │       ┌──────────────────────┐
   │       │  API Server          │
   │       │  - JWT Auth          │
   │       │  - Challenge CRUD    │
   │       │  - Signaling WebRTC  │
   │       └──┬──────────────────┘
   │          │ (4)
   │          │ Socket.io
   │          │ emit 'run'
   │          ▼
   │       ┌──────────────────────┐
   │       │  Runner (Node.js)    │
   │       │ - Executa código     │
   │       │ - Compila/Interpreta │
   │       │ - Captura logs       │
   │       └──┬───────────────────┘
   │          │ (5)
   │          │ Socket.io
   │          │ emit 'runner-log'
   └──────────┴──────────────────▶ API ─▶ Socket.io ─▶ Frontend
                                        (logs in realtime)
```

## 🎯 Endpoints da API

### Autenticação
```
POST   /login          { email, password }          → { access_token, user }
POST   /register       { email, password, role }    → { access_token, user }
```

### Desafios
```
GET    /challenges                                  → Challenge[]
PUT    /challenges/:id { title, description, ... } → Challenge (interviewer only)
POST   /challenges     { title, description, ... } → Challenge (interviewer only)
```

### Execução de Código
```
POST   /run            { language, code, sessionId } → { sessionId }
```

### Socket.io Events
```
Client → Server:
  - join-session(sessionId)
  - webrtc-offer/answer/candidate

Server → Client:
  - log { sessionId, data }
  - webrtc-offer/answer/candidate
```

## 👥 Perfis de Usuário

### Entrevistador
- ✅ Login/Registro
- ✅ Acessar Dashboard
- ✅ Ver lista de desafios
- ✅ Editar desafios existentes
- ✅ Criar novos desafios
- ✅ Ver logs de execução

### Candidato
- ✅ Login/Registro
- ✅ Acessar sessão de entrevista
- ✅ Ver um desafio por vez
- ✅ Escrever código no editor
- ✅ Selecionar linguagem
- ✅ Executar código
- ✅ Ver logs de saída
- ✅ Navegar entre desafios (anterior/próximo)
- ✅ Compartilhar tela (WebRTC - preparação)

## 🛠️ Tecnologias

### Backend
- **Express.js** - Servidor HTTP
- **Socket.io** - Comunicação real-time
- **JWT (jsonwebtoken)** - Autenticação
- **Node.js 20** - Runtime

### Executor
- **Python 3.12** - Interpretador Python
- **Java 21** - JDK
- **Go 1.25.5** - Compilador Go
- **Node.js 20** - JavaScript/TypeScript
- **Mono/C#** - .NET runtime
- **Ubuntu 24.04** - Base image

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router v6** - Roteamento
- **Axios** - HTTP client
- **Socket.io Client** - WebSocket client
- **Monaco Editor** - Editor de código
- **xterm.js** - Terminal web

### Design
- **CSS3** - Styling
- **Flat 2.0 Design** - Visual system
- **CSS Variables** - Temas customizáveis

## 📊 Requisitos de Sistema

### Mínimo
- RAM: 4GB
- CPU: 2 cores
- Espaço em disco: 3GB (imagens Docker)
- Docker: 20.10+
- Docker Compose: 1.29+

### Recomendado
- RAM: 8GB
- CPU: 4 cores
- Espaço em disco: 10GB
- Internet: 100 Mbps (para pull de images)

## 🚀 Quick Start

```bash
# 1. Clonar repositório
git clone <repo> sourcerank
cd sourcerank

# 2. Inicializar (com Docker)
./start.sh

# 3. Acessar
# Frontend: http://localhost:5173
# API: http://localhost:4000

# 4. Login de teste
# Email: teste@sourcerank.com
# Senha: senha123
# Perfil: Entrevistador ou Candidato
```

## 📝 Desafios Pré-configurados

1. **Somar dois números** - Básico
2. **Fatorial (iterativo)** - Loops e variáveis
3. **Inverter string** - Manipulação de strings
4. **Buscar mínimo** - Array e condicionais
5. **Soma de pares** - Filtragem e agregação

## ⚙️ Variáveis de Ambiente

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000
```

### API (.env)
```
PORT=4000
JWT_SECRET=seu-secret-key
```

### Runner (docker-compose)
```
API_URL=http://api:4000
```

## 🐛 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Frontend não carrega | Verificar `docker logs sr_web` |
| API retorna 401 | Verificar token JWT em localStorage |
| Logs não aparecem | Verificar WebSocket em DevTools |
| Runner falha | Verificar `docker logs sr_runner` |
| Porta ocupada | `docker compose down` então `docker compose up` |

## 📚 Documentação

- [README.md](README.md) - Visão geral completa
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guia de produção
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guia para desenvolvedores
- Este arquivo - Estrutura do projeto

---

Última atualização: 2 de janeiro de 2026
