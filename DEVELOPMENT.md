# Guia de Desenvolvimento

## Setup Local (sem Docker)

### Pré-requisitos
- Node.js 20+
- Python 3.12
- Java 21 (opcional, para testes Java)
- Go 1.25.5 (opcional)

### Instalar e Rodar

#### 1. API Server
```bash
cd api
npm install
npm start
# Acessa em http://localhost:4000
```

#### 2. Runner Service
```bash
cd runner
npm install
npm start
# Conecta à API automaticamente
```

#### 3. Frontend
```bash
cd web
npm install
npm run dev
# Acessa em http://localhost:5173
```

## Estrutura de Código

### Componentes React

#### CodeEditor.tsx
- Integra Monaco Editor
- Props: `code`, `language`, `onChange`, `readOnly`
- Suporta: Python, Java, Go, JavaScript, TypeScript, C#
- Tema: vs-dark (dark mode)

#### ExecutionTerminal.tsx
- Usa xterm.js para terminal web
- Recebe logs via props
- Auto-redimensiona com a janela
- Tema: Dark com fundo #0b0b0b

#### ChallengeView.tsx
- Exibe detalhes do desafio
- Mostra entrada e saída esperada
- Botão "Editar" para entrevistadores

#### ChallengeNavigator.tsx
- Lista numerada de desafios
- Indica desafios completados
- Botões anterior/próximo

### Serviços

#### api.ts
- Instância axios centralizada
- Endpoints:
  - GET `/challenges`
  - PUT `/challenges/:id`
  - POST `/run`
  - POST `/login` (MVP: sem validação real)
  - POST `/register` (MVP: sem validação real)

#### auth.service.ts
- Gerencia token JWT em localStorage
- Funções: `setToken`, `getToken`, `getUser`, `isAuthenticated`, `logout`

#### execution.service.ts
- Socket.io client
- Eventos: `join-session`, `runner-log`, `webrtc-*`
- Auto-conecta na primeira chamada

### Contextos

#### AuthContext
- Fornece `user`, `isAuthenticated`, `login`, `register`, `logout`
- Persiste no localStorage
- Padrão: React Context + Hooks

#### SessionContext
- Fornece `currentChallengeIndex`, `nextChallenge`, `previousChallenge`
- Gerencia navegação de desafios

## Adicionar Novo Desafio

### 1. Editar `api/challenges.json`
```json
{
  "id": 6,
  "title": "Novo Desafio",
  "description": "Descrição...",
  "inputExample": "entrada",
  "outputExample": "saída"
}
```

### 2. Via Dashboard
- Login como entrevistador
- Click "Editar" e altere
- Salva automaticamente

## Adicionar Nova Linguagem

### 1. Atualizar `runner/index.js`
```javascript
if(language === 'ruby'){
  const file = path.join(tmpDir, 'main.rb');
  fs.writeFileSync(file, code);
  return spawnAndStream('ruby', [file], sessionId);
}
```

### 2. Atualizar `runner/Dockerfile`
```dockerfile
RUN apt-get install -y ruby
```

### 3. Atualizar Frontend `IntervieweeView.tsx`
```jsx
<option value="ruby">Ruby</option>
```

## Adicionar Autenticação Real

### 1. Instalar dependências
```bash
cd api
npm install bcryptjs
```

### 2. Modificar `api/index.js`
```javascript
const bcrypt = require('bcryptjs');

// Armazenar em banco de dados em produção
const users = new Map();

app.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, role, password: hash };
  users.set(user.id, user);
  // ...
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // ...
});
```

## Adicionar Persistência (SQLite)

### 1. Instalar dependências
```bash
cd api
npm install better-sqlite3
```

### 2. Criar arquivo `api/db.js`
```javascript
const Database = require('better-sqlite3');
const db = new Database(':memory:'); // ou './sourcerank.db'

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT
  );
  
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY,
    title TEXT,
    description TEXT,
    input_example TEXT,
    output_example TEXT
  );
`);

module.exports = db;
```

### 3. Usar em `api/index.js`
```javascript
const db = require('./db');

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // ...
});
```

## Testes

### Testar API manualmente
```bash
# Login
curl -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@test.com","password":"123"}'

# Obter desafios
curl http://localhost:4000/challenges \
  -H "Authorization: Bearer <token>"

# Executar código
curl -X POST http://localhost:4000/run \
  -H "Content-Type: application/json" \
  -d '{"language":"python","code":"print(2+2)","sessionId":"123"}'
```

### Testar componentes React
```bash
npm install @testing-library/react @testing-library/jest-dom vitest

# Criar arquivo test
echo "import { render } from '@testing-library/react';" > src/components/Editor/__tests__/CodeEditor.test.tsx

# Rodar testes
npm run test
```

## Debugging

### Frontend
1. Abrir DevTools (F12)
2. Aba Network → XHR/Fetch (requisições HTTP)
3. Aba Console (erros JavaScript)
4. Aba Application → LocalStorage (tokens e dados)

### Backend (API)
```bash
# Ver logs
docker logs sr_api -f

# Entrar no container
docker exec -it sr_api sh

# Testar conectividade
docker exec sr_runner curl http://api:4000/challenges
```

### Runner
```bash
# Testar execução de Python
docker exec sr_runner python3 -c "print('Teste')"

# Entrar no container
docker exec -it sr_runner bash

# Ver temporários
ls /tmp/sr_*
```

## Performance

### Frontend
- Monaco Editor é pesado (~5MB). Para SPA leve, considerar CodeMirror
- xterm.js é otimizado para grandes volumes de logs
- Usar React.memo() em componentes que não mudam frequentemente

### Backend
- Socket.io é escalável mas consumidor de memória
- Para produção com muitos usuários, usar Redis adapter
- Limpar arquivos temporários regularmente

### Runner
- Compilar/interpretar é processamento intensivo
- Considerar pool de workers (cluster module)
- Implementar timeout e kill automático

## Próximos Passos Recomendados

### Curto Prazo (1-2 sprints)
- [ ] Adicionar testes unitários (Jest)
- [ ] Implementar persistência (SQLite/PostgreSQL)
- [ ] Adicionar validação de entrada (XSS/code injection)
- [ ] Implementar rate limiting

### Médio Prazo (2-4 sprints)
- [ ] Dashboard com estatísticas (gráficos)
- [ ] Histórico de submissões
- [ ] Sistema de pontuação/ranking
- [ ] Notificações em tempo real (email/webhook)

### Longo Prazo (4+ sprints)
- [ ] Mobile app (React Native)
- [ ] AI-powered code review
- [ ] Integração com GitHub/GitLab
- [ ] Video call integrado (Twilio/Agora)
- [ ] Painel colaborativo (multiplayer coding)

## Recursos

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Socket.io Docs](https://socket.io/docs/)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/)
- [xterm.js Docs](https://xtermjs.org/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

Dúvidas? Abra uma issue no GitHub ou consulte a documentação acima.
