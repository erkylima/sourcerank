# SourceRank - Plataforma de Entrevistas Técnicas

Plataforma completa para condução de entrevistas técnicas com execução de código em tempo real, editor Monaco, terminal xterm e suporte a múltiplas linguagens de programação.

## 🚀 Stack Tecnológico

### Frontend
- **React 19** com TypeScript
- **Vite** como bundler
- **Monaco Editor** para edição de código com 6 linguagens
- **xterm.js** para terminal web
- **Socket.io-client** para comunicação WebSocket
- **React Router v6** para roteamento com acesso baseado em papéis
- **Flat 2.0** como design system

### Backend
- **Node.js** com TypeScript
- **Express.js** para API REST
- **PostgreSQL** para persistência de dados
- **Socket.io** para WebSocket bidireccional
- **JWT** para autenticação
- **bcryptjs** para hash seguro de senhas

### Execution Runtime
- **Python 3.12**
- **Java 21**
- **Go 1.25.5**
- **Node.js 20**
- **TypeScript (ts-node)**
- **C# (Mono)**

## 📋 Arquitetura

### Frontend (`web/`)
```
src/
├── pages/              # Componentes de página
├── components/         # Componentes reutilizáveis
├── services/          # Serviços (API, autenticação, execução)
├── context/           # React Context (autenticação, sessão)
├── types/             # Definições TypeScript
└── styles/            # Design system Flat 2.0
```

### Backend (`api/`)
```
src/
├── config/            # Configuração (env, database)
├── modules/
│   ├── auth/         # Autenticação e autorização
│   ├── challenges/   # Gerenciamento de desafios
│   ├── sessions/     # Gerenciamento de sessões
│   ├── users/        # Gerenciamento de usuários
│   └── execution/    # Orquestração de execução
├── middlewares/      # Middlewares Express
├── websocket/        # Gateways Socket.io
├── utils/            # Utilitários (erros, validação)
├── app.ts           # Configuração Express
└── server.ts        # Inicialização do servidor
```

## 🗄️ Banco de Dados

### Tabelas
- **users** - Contas de usuários (interviewer/interviewee)
- **challenges** - Desafios de programação
- **sessions** - Sessões de entrevista
- **executions** - Execuções de código com resultado
- **logs** - Logs de execução em tempo real

### Schema
Ver [docker-compose.yml](./docker-compose.yml) para detalhes SQL completos.

## 🔐 Autenticação

- **JWT** com expiração configurável (padrão: 24h)
- Dois papéis: `interviewer` (criador de desafios) e `interviewee` (candidato)
- Token armazenado em `localStorage` no frontend
- Enviado via header `Authorization: Bearer <token>`

## 🔌 WebSocket Events

### Execução de Código
```
JOIN execution:<executionId>
→ execution-log { executionId, message, level, timestamp }
→ execution-status { status, stdout, stderr, exitCode }
```

### Sessão
```
JOIN session:<sessionId>
→ challenge-changed { challengeId }
→ session-status { status }
```

## 🚢 Docker Compose

Serviços:
- **web** - Frontend React (port 5173)
- **api** - Backend Node.js (port 4000)
- **postgres** - Database (port 5432)
- **runner** - Code execution (port 3001)

Health checks inclusos para orquestração automática de dependências.

## 📝 API Endpoints

### Autenticação
```
POST   /auth/register      # Registrar novo usuário
POST   /auth/login        # Login
GET    /auth/me           # Obter usuário autenticado
```

### Desafios
```
GET    /challenges          # Listar desafios
GET    /challenges/:id      # Obter desafio específico
POST   /challenges          # Criar desafio (interviewer)
PUT    /challenges/:id      # Atualizar desafio (interviewer)
DELETE /challenges/:id      # Deletar desafio (interviewer)
```

### Sessões
```
GET    /sessions           # Listar sessões do usuário
POST   /sessions           # Criar sessão (interviewer)
GET    /sessions/:id       # Obter sessão específica
PATCH  /sessions/:id/status      # Atualizar status
PATCH  /sessions/:id/challenge   # Mudar desafio atual
```

### Execução
```
POST   /executions              # Submeter código
GET    /executions/:id          # Status da execução
GET    /executions/:id/logs     # Obter logs
GET    /executions/session/:sessionId  # Execuções da sessão
POST   /executions/:id/report   # Reportar resultado (Runner)
```

## 🏃 Como Executar

### Desenvolvimento
```bash
# Terminal 1: Frontend
cd web
npm install
npm run dev

# Terminal 2: Backend
cd api
npm install
npm run dev

# Terminal 3: Runner
cd runner
npm install
npm start
```

### Docker Compose
```bash
docker-compose up --build
```

## 📚 Estrutura de Desafios

```json
{
  "title": "Factorial Function",
  "description": "Implement a function that calculates factorial",
  "difficulty": "easy",
  "examples": "{\"input\": \"5\", \"output\": \"120\"}"
}
```

## 🔑 Variáveis de Ambiente

### Backend (`api/.env`)
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/sourcerank
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
RUNNER_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

## 🐛 Troubleshooting

### Conexão com banco de dados
- Verificar se PostgreSQL está rodando: `docker-compose ps`
- Verificar credenciais em `.env` vs `docker-compose.yml`
- Resetar database: `docker-compose down -v`

### Erros de compilação TypeScript
```bash
npm run typecheck
```

### Logs do Runner
```bash
docker-compose logs runner
```

## 📖 Documentação Adicional

- [README.md](./README.md) - Visão geral do projeto
- [STRUCTURE.md](./STRUCTURE.md) - Descrição completa da arquitetura
- [API_EXAMPLES.md](./API_EXAMPLES.md) - Exemplos de requisições
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Guia de desenvolvimento
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guia de deploy em produção

## 🤝 Roles e Permissões

### Interviewer
- ✅ Criar e gerenciar desafios
- ✅ Iniciar sessões
- ✅ Ver execuções em tempo real
- ✅ Navegar entre desafios na sessão

### Interviewee
- ✅ Visualizar desafios disponíveis
- ✅ Submeter código para execução
- ✅ Ver resultado de execução
- ✅ Receber logs em tempo real

## 🎨 Linguagens Suportadas

1. **Python 3.12**
2. **JavaScript (Node.js 20)**
3. **TypeScript (ts-node)**
4. **Java 21**
5. **Go 1.25.5**
6. **C# (Mono)**

## ⏱️ Limites de Execução

- **Timeout**: 30 segundos por padrão
- **Memória**: Limitada pelo container Docker
- **CPU**: Compartilhada com outras execuções
- **Logs**: Transmitidos em tempo real via WebSocket

## 🔄 Fluxo de Execução

1. Frontend submete código via `POST /executions`
2. API cria registro e envia para Runner via HTTP
3. Runner executa em container isolado
4. Saída é capturada e reportada via `POST /executions/:id/report`
5. API broadcast via WebSocket para todos os clientes
6. Frontend atualiza terminal com `execution-log` events

## ✅ Checklist de Funcionalidades

- ✅ Autenticação JWT com 2 roles
- ✅ CRUD de desafios
- ✅ Criação e gerenciamento de sessões
- ✅ Submissão e execução de código
- ✅ Terminal em tempo real com xterm.js
- ✅ Editor com 6 linguagens suportadas
- ✅ WebSocket para logs em tempo real
- ✅ Banco de dados PostgreSQL
- ✅ Docker Compose orquestrado
- ✅ Design system Flat 2.0
- ✅ TypeScript strict mode
- ✅ Health checks em todos os serviços

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ para melhorar o processo de entrevistas técnicas**
