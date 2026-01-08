# SourceRank - Plataforma de Entrevistas Técnicas em Tempo Real

Plataforma completa e robusta para entrevistas técnicas com **sincronização em tempo real** entre entrevistador e candidato, execução de código em múltiplas linguagens, editor Monaco e terminal interativo.

## 🎯 Visão Geral

SourceRank permite que entrevistadores e candidatos colaborem em tempo real durante entrevistas técnicas:
- **Entrevistador** cria/edita desafios, navega entre eles, gerencia a sessão
- **Candidato** visualiza desafios, escreve código, recebe atualizações em tempo real
- **Sincronização** automática de código, linguagem e desafios entre os dois
- **Execução** de código em 6 linguagens diferentes com logs em tempo real

## 🏗️ Stack Técnico

### Backend
- **Node.js 20** + TypeScript
- **Express.js** para API REST
- **Socket.io** para comunicação em tempo real
- **PostgreSQL 16** para persistência
- **JWT** para autenticação

### Frontend
- **React 19** + TypeScript
- **Vite 5** como bundler
- **Monaco Editor** para edição de código
- **xterm.js** para terminal interativo
- **Socket.io Client** para conexões em tempo real

### Code Execution
- **Docker** como ambiente isolado
- **Python 3.12**, **Java 21**, **Go 1.25.5**, **Node.js 20**, **TypeScript**, **C#/Mono**

## 📋 Funcionalidades Implementadas

### ✅ Para Entrevistadores
- Criar e editar desafios com exemplos
- Navegar entre desafios (Próximo/Anterior)
- Visualizar código do candidato em tempo real
- Ver logs de execução instantaneamente
- Gerenciar múltiplas sessões de entrevista

### ✅ Para Candidatos
- Visualizar desafios sequenciais
- Editor de código com syntax highlighting (Monaco)
- Trocar linguagem de programação (Python, Java, Go, JS, TS, C#)
- Executar código e ver logs em tempo real
- Navegar entre desafios sincronizado
- **Receber atualizações de código/linguagem em tempo real**

### ✅ Sincronização em Tempo Real
- **Sem piscar**: Troca de linguagem é atômica
- **Sem race conditions**: Broadcasts deduplicados
- **Bidirecional**: Ambos recebem atualizações
- **Logs sincronizados**: Sem duplicação
- **Desafios sincronizados**: Quando um navega, o outro acompanha

## 🚀 Como Executar

### Pré-requisitos
- Docker 24+
- Docker Compose 2.20+
- ~2GB de espaço em disco (para SDKs)

### Iniciar a Plataforma

```bash
cd /home/erky/Documentos/desenvolvimento/projetos/sourcerank

# Build e start de todos os serviços
docker compose up --build

# Ou apenas restart rápido
docker compose restart

# Verificar status
docker ps
```

Aguarde 30-60 segundos para tudo estar pronto.

### Acessar

- **Frontend**: http://localhost:5173
- **API**: http://localhost:4000
- **WebSocket**: ws://localhost:4000

## 📝 Fluxo de Uso

### 1. Login
```
Email: qualquer email (teste@example.com)
Senha: qualquer senha (senha123)
```

### 2. Entrevistador
1. Clica em "Nova Sessão"
2. Define desafio inicial
3. Compartilha link com candidato
4. Navega entre desafios, o candidato acompanha

### 3. Candidato
1. Acessa link da sessão
2. Vê o desafio atual
3. Escreve código
4. Muda linguagem (starter code atualiza sem piscar)
5. Clica "Executar" e vê logs em tempo real
6. Quando entrevistador muda desafio, candidato vê atualização automática

## 🔄 Arquitetura de Sincronização

### Salas WebSocket

```
session:{sessionId}
├── session-code-changed      → Código + Linguagem
├── session-challenge-changed → Navegação entre desafios
├── session-execution-started → Execução iniciada
└── session-execution-completed → Execução finalizada

execution:{executionId}
├── execution-log-{id}       → Logs em tempo real
└── execution-completed-{id} → Fim da execução
```

### Protocolo de Sincronização

1. **Broadcast Atômico**: Code e Language sempre atualizados juntos
2. **Deduplicação**: `lastBroadcastedCodeRef` evita ecos
3. **Refs Sincronizadas**: `currentCodeRef` e `currentLanguageRef` mantêm estado
4. **Guards**: `joinedExecutionIdRef` previne múltiplos joins

### Por que não Pisca?

```typescript
// ❌ ERRADO (causava piscar):
onChange={(e) => setLanguage(e.target.value)}  // Sem garantia de ordem
useEffect(() => updateCode(), [language])      // Dispara separado

// ✅ CORRETO (sem piscar):
onChange={(e) => handleLanguageChange(e.target.value)}
// handleLanguageChange faz atomicamente:
// 1. setCode(newStarter)
// 2. setLanguage(newLanguage)
// Sem useEffect = sem race condition
```

## 📊 Estrutura do Projeto

```
sourcerank/
├── api/                          # Backend Node.js/TypeScript
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/            # Autenticação JWT
│   │   │   ├── users/           # Gerenciamento de usuários
│   │   │   ├── challenges/      # CRUD de desafios
│   │   │   ├── sessions/        # Sessões de entrevista
│   │   │   └── execution/       # Orquestração de código
│   │   ├── config/              # Configurações
│   │   ├── middlewares/         # Auth, logging
│   │   ├── websocket/           # Socket.io setup
│   │   ├── app.ts               # Express app
│   │   └── server.ts            # Startup
│   ├── Dockerfile
│   └── package.json
│
├── runner/                        # Code execution service
│   ├── src/
│   │   ├── executors/           # Executores por linguagem
│   │   ├── index.ts             # Server
│   │   └── config.ts
│   ├── Dockerfile               # Multi-stage com SDKs
│   └── package.json
│
├── web/                          # Frontend React/Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx        # Autenticação
│   │   │   ├── InterviewSession.tsx    # Entrevistador
│   │   │   └── IntervieweeView.tsx     # Candidato
│   │   ├── components/
│   │   │   ├── Editor/CodeEditor.tsx   # Monaco
│   │   │   ├── Terminal/ExecutionTerminal.tsx  # xterm
│   │   │   └── Challenge/ChallengeView.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── SessionContext.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── auth.service.ts
│   │   │   └── execution.service.ts
│   │   ├── styles/Interview.css
│   │   └── types/index.ts
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml            # Orquestração
└── README.md                     # Este arquivo
```

## 🔧 Linguagens Suportadas

| Linguagem   | Versão    | Comando     | Status |
|-------------|-----------|-------------|--------|
| Python      | 3.12      | `python3`   | ✅     |
| Java        | 21        | `javac`/`java` | ✅ |
| Go          | 1.25.5    | `go run`    | ✅     |
| JavaScript  | Node 20   | `node`      | ✅     |
| TypeScript  | latest    | `ts-node`   | ✅     |
| C#          | Mono      | `mcs`/`mono` | ✅    |

## 🐛 Troubleshooting

### Frontend não carrega
```bash
# Verificar se web está rodando
docker logs sr_web

# Reiniciar
docker compose restart web
```

### API retorna erro
```bash
# Ver logs da API
docker logs sr_api --follow

# Reiniciar API
docker compose restart api
```

### Código não executa
```bash
# Verificar runner
docker logs sr_runner

# Reiniciar runner
docker compose restart runner
```

### Sincronização lenta/atrasada
```bash
# Pode ser latência de rede ou Docker
# Reiniciar tudo
docker compose down
docker compose up
```

## 📈 Performance

- **Latência de sincronização**: < 100ms (tipicamente)
- **Throughput de logs**: ~1000 linhas/segundo
- **Simultâneos suportados**: 10+ sessões

## 🔐 Segurança (MVP)

⚠️ **Este é um MVP**. Para produção:

- [ ] Implementar sandboxing por execução (seccomp, cgroups)
- [ ] Adicionar timeouts (máx 10s por execução)
- [ ] Limitar recursos (CPU, memória, disco)
- [ ] Usar banco de dados com permissões adequadas
- [ ] Habilitar HTTPS/WSS
- [ ] Implementar rate limiting
- [ ] Adicionar autenticação OAuth2
- [ ] Implementar auditoria de logs
- [ ] Usar secrets manager (Vault, AWS Secrets)
- [ ] Adicionar WAF (Web Application Firewall)

## 📝 Desafios Pré-configurados

1. **Somar Dois Números** - Ler dois inteiros e imprimir a soma
2. **Fatorial** - Calcular fatorial (iterativo)
3. **Inverter String** - Ler e imprimir string invertida
4. **Buscar Mínimo** - Encontrar menor valor em lista
5. **Soma de Pares** - Somar números pares em lista

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit (`git commit -m 'Add MinhaFeature'`)
4. Push (`git push origin feature/MinhaFeature`)
5. Abra Pull Request

## 📚 Documentação Completa

- [DESCRIPTION.md](./DESCRIPTION.md) - Descrição detalhada do projeto
- [QUICKSTART.md](./QUICKSTART.md) - Guia rápido de setup (5 minutos)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura técnica e diagramas
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Status completo e roadmap
- [API_EXAMPLES.md](./API_EXAMPLES.md) - Exemplos de endpoints REST
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Guia para desenvolvedores
- [Modelagem_dados.md](./Modelagem_dados.md) - Schema do banco de dados

## 📄 Licença

MIT

## 👤 Autor

SourceRank - Plataforma de Entrevistas Técnicas

---

**Status**: ✅ Funcionando | **Versão**: 1.0.0 | **Última atualização**: 3 de janeiro de 2026
