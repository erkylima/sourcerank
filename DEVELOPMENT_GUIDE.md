# Guia de Desenvolvimento - SourceRank API

## Ambiente de Desenvolvimento

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16+
- Git
- Docker (opcional, para PostgreSQL em container)

### Instalação Inicial

```bash
# 1. Clonar repositório
git clone <repository-url>
cd sourcerank

# 2. Instalar dependências do backend
cd api
npm install

# 3. Instalar dependências do frontend
cd ../web
npm install

# 4. Instalar dependências do runner
cd ../runner
npm install

# 5. Configurar variáveis de ambiente
# Backend
cp api/.env.example api/.env
# Frontend
cp web/.env.example web/.env
```

### Iniciar Desenvolvimento com Docker Compose

```bash
# Terminal principal (na raiz do projeto)
docker-compose up --build

# Isso iniciará:
# - Frontend em http://localhost:5173
# - Backend em http://localhost:4000
# - PostgreSQL em localhost:5432
# - Runner em http://localhost:3001
```

### Iniciar Desenvolvimento Local

**Terminal 1 - Frontend:**
```bash
cd web
npm run dev
# Acessa em http://localhost:5173
```

**Terminal 2 - Backend:**
```bash
cd api
npm run dev
# Inicia em http://localhost:4000
# Recompila automaticamente com ts-node-dev
```

**Terminal 3 - Runner:**
```bash
cd runner
npm start
# Escuta em http://localhost:3001
```

## Estrutura do Backend

### Módulos

Cada módulo segue o padrão MVC:
- `.types.ts` - Interfaces TypeScript
- `.service.ts` - Lógica de negócio e queries SQL
- `.controller.ts` - Handlers Express
- `.routes.ts` - Definição de rotas

### Exemplo: Criar novo módulo

1. **Criar pasta:**
```bash
mkdir -p src/modules/mymodule
```

2. **Criar tipos** (`mymodule.types.ts`):
```typescript
export interface MyEntity {
  id: string
  name: string
  created_at: Date
}
```

3. **Criar service** (`mymodule.service.ts`):
```typescript
import { query } from '../../config/database'
import { MyEntity } from './mymodule.types'

export class MyModuleService {
  async create(name: string): Promise<MyEntity> {
    const id = uuidv4()
    const result = await query(
      'INSERT INTO my_entities (id, name) VALUES ($1, $2) RETURNING *',
      [id, name]
    )
    return result.rows[0]
  }

  async getById(id: string): Promise<MyEntity> {
    const result = await query(
      'SELECT * FROM my_entities WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) throw new Error('Not found')
    return result.rows[0]
  }
}

export default new MyModuleService()
```

4. **Criar controller** (`mymodule.controller.ts`):
```typescript
import { Request, Response } from 'express'
import myService from './mymodule.service'

export class MyModuleController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body
      const entity = await myService.create(name)
      res.status(201).json({ entity })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const entity = await myService.getById(id)
      res.json({ entity })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }
}

export default new MyModuleController()
```

5. **Criar rotas** (`mymodule.routes.ts`):
```typescript
import { Router } from 'express'
import controller from './mymodule.controller'
import { authenticateToken } from '../../middlewares/auth.middleware'

const router = Router()

router.post('/', authenticateToken, (req, res) => controller.create(req, res))
router.get('/:id', authenticateToken, (req, res) => controller.getById(req, res))

export default router
```

6. **Registrar no app.ts:**
```typescript
import myRoutes from './modules/mymodule/mymodule.routes'

// ...
app.use('/my-entities', myRoutes)
```

## Banco de Dados

### Conectar ao PostgreSQL localmente

```bash
# Com Docker Compose rodando
psql postgresql://sourcerank:sourcerank_dev@localhost:5432/sourcerank

# Comandos úteis
\dt                    # Listar tabelas
\d users               # Descrever tabela
SELECT * FROM users;   # Query
```

### Adicionar Migration

1. Criar script SQL em `api/migrations/`
2. Executar manualmente via `psql` ou
3. Adicionar ao `initializeDatabase()` em `config/database.ts`

### Resetar Database

```bash
# Com Docker Compose
docker-compose down -v
docker-compose up

# Sem Docker
dropdb interview
createdb interview
# Reexecute o script de schema
```

## TypeScript

### Type Checking

```bash
# Verificar tipos sem compilar
npm run typecheck

# Compilar TypeScript
npm run build

# Compilar e assistir
npm run watch
```

### Strict Mode

O projeto usa `strict: true` no `tsconfig.json`. Sempre:
- ✅ Declare tipos em parâmetros e retorno
- ✅ Use `?` para propriedades opcionais
- ✅ Avoid `any` (use `unknown` se necessário)
- ✅ Declare tipos explicitamente

### Exemplo correto:

```typescript
// ✅ CORRETO
function getUserById(id: string): Promise<User | null> {
  // ...
}

// ❌ ERRADO
function getUserById(id) {
  // ...
}

// ❌ ERRADO
function getUserById(id: string): any {
  // ...
}
```

## Autenticação e Autorização

### Criar rota protegida

```typescript
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware'

// Apenas autenticado
router.get('/me', authenticateToken, handler)

// Apenas interviewer
router.post('/', 
  authenticateToken, 
  requireRole(['interviewer']), 
  handler
)

// Múltiplos roles
router.patch('/:id', 
  authenticateToken, 
  requireRole(['interviewer', 'interviewee']), 
  handler
)
```

### Acessar dados do usuário autenticado

```typescript
app.get('/me', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).userId      // Do token JWT
  const userRole = (req as any).userRole  // Do token JWT
  // ...
})
```

## WebSocket (Socket.io)

### Emitir eventos para clientes

```typescript
import { Express } from 'express'

// No app.locals está disponível executionGateway
const gateway = app.locals.executionGateway

// Broadcast para uma execução
gateway.broadcastLog('exec-id', 'Code compiled', 'info')

// Broadcast para sessão
gateway.broadcastToSession('session-id', 'execution-complete', {
  executionId: 'exec-id',
  status: 'completed'
})
```

### Ouvir eventos do cliente

```typescript
// Em ExecutionGateway no websocket/execution.gateway.ts
this.io.on('connection', (socket: Socket) => {
  socket.on('custom-event', (data) => {
    // Handle
  })
})
```

## Testing

### Testar API com curl

```bash
# Registrar
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123","role":"interviewer"}'

# Login e obter token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123"}' | jq -r '.token')

# Usar token
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/auth/me
```

### Testar WebSocket

```javascript
// No browser console
const socket = io('http://localhost:4000')
socket.emit('join-execution', 'exec-id')
socket.on('execution-log', (data) => console.log(data))
```

## Debugging

### Ativar logs detalhados

```bash
# Backend
DEBUG=* npm run dev

# Ou em código
console.log('Debug:', data)
```

### Debugger VSCode

Criar `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to ts-node",
      "port": 9229,
      "address": "127.0.0.1",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

Iniciar backend com debugger:
```bash
node --inspect-brk -r ts-node/register src/server.ts
```

## Performance

### Indexes de Banco de Dados

Criar índices para queries frequentes:
```sql
CREATE INDEX idx_sessions_user_id 
ON sessions(interviewer_id, interviewee_id);

CREATE INDEX idx_executions_session_id 
ON executions(session_id);
```

### Caching

Para implementar cache:
```typescript
// Usar Redis ou in-memory cache
const cache = new Map()

// Antes de query
const cached = cache.get(key)
if (cached) return cached

// Após query
cache.set(key, result)
```

## Commits e Versionamento

### Convenção de Commit

```
feat: adicionar novo endpoint de desafios
fix: corrigir erro de autenticação JWT
docs: atualizar README
style: formatar código TypeScript
refactor: reorganizar módulo auth
test: adicionar testes de autenticação
chore: atualizar dependências
```

### Versioning (Semantic)

- `MAJOR.MINOR.PATCH` (ex: 1.0.0)
- `MAJOR` quando breaking changes
- `MINOR` quando novas features
- `PATCH` quando bug fixes

## Deployment

### Build para Produção

```bash
# Compilar TypeScript
npm run build

# Testar build localmente
npm start

# Output em dist/
```

### Variáveis de Produção

```bash
# .env.production
NODE_ENV=production
PORT=3000
JWT_SECRET=<gerar-aleatório-seguro>
DATABASE_URL=postgresql://<db-url>
```

## Troubleshooting

### "Cannot find module"
```bash
# Limpar cache e reinstalar
rm -rf node_modules dist
npm install
```

### Porta já em uso
```bash
# Encontrar processo usando porta
lsof -i :4000

# Matar processo
kill -9 <PID>
```

### Erro de compilação TypeScript
```bash
# Verificar tipos
npm run typecheck

# Forçar recompilação
rm -rf dist
npm run build
```

### Database connection refused
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Ou com Docker
docker-compose ps postgres

# Verificar credenciais em .env
```

## Recursos Úteis

- [Express.js Docs](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Socket.io Documentation](https://socket.io/docs/)
- [JWT Introduction](https://jwt.io/introduction)

---

Última atualização: 2025-01-03
