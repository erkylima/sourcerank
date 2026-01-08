# QUICKSTART - SourceRank

Guia rápido para colocar a plataforma rodando em minutos.

## 🚀 Inicialização Rápida

### 1. Pré-requisitos
```bash
# Verifique se tem instalado:
docker --version        # Docker 24+
docker-compose --version # Docker Compose 2.20+
```

### 2. Clonar e Navegar
```bash
cd /home/erky/Documentos/desenvolvimento/projetos/sourcerank
```

### 3. Iniciar Serviços
```bash
# Build e start completo
docker compose up --build

# Ou apenas restart rápido
docker compose restart
```

Aguarde 30-60 segundos para tudo estar pronto. Você verá:
```
✅ Database initialized successfully
✅ Challenges seeded successfully
✅ Starter codes seeded successfully
✅ WebSocket gateway initialized
✅ API listening on http://0.0.0.0:4000
```

### 4. Acessar Aplicação

| Serviço | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **API REST** | http://localhost:4000 |
| **WebSocket** | ws://localhost:4000 |
| **Database** | postgres://localhost:5432 |

### 5. Login Inicial
```
Email: teste@example.com
Senha: teste123
```

---

## 👤 Fluxo de Uso

### Entrevistador
1. Login em http://localhost:5173
2. Clica "Nova Sessão"
3. Seleciona desafio inicial
4. Compartilha link com candidato
5. Monitora em tempo real

### Candidato
1. Recebe link da sessão
2. Clica para aceitar
3. Vê desafio e escreve código
4. Clica "Executar" para testar

---

## 🔧 Comandos Úteis

```bash
# Ver status dos containers
docker ps

# Ver logs de um serviço
docker logs sr_api --follow
docker logs sr_web --follow
docker logs sr_runner --follow

# Reiniciar um serviço específico
docker compose restart web
docker compose restart api
docker compose restart runner

# Parar tudo
docker compose down

# Limpar volumes (reinicia banco)
docker compose down -v

# Build sem cache
docker compose build --no-cache
```

---

## 🧪 Testar Funcionalidades Principais

### Test 1: Código Sincronizado
1. Abra 2 abas: uma para Entrevistador, outra para Candidato
2. Candidato digita código
3. Entrevistador deve ver em tempo real (< 100ms)

### Test 2: Troca de Linguagem
1. Candidato está em Python
2. Candidato muda para JavaScript
3. Starter code muda instantaneamente (sem piscar)
4. Entrevistador vê a mudança

### Test 3: Execução de Código
1. Candidato clica "Executar"
2. Ambos veem logs em tempo real
3. Sem duplicação de mensagens

### Test 4: Navegação de Desafios
1. Entrevistador clica "Próximo desafio"
2. Candidato vê novo desafio automaticamente
3. Código anterior é preservado no histórico

---

## ❌ Troubleshooting Rápido

### Frontend não carrega
```bash
docker logs sr_web
docker compose restart web
```

### API retorna erro
```bash
docker logs sr_api
docker compose restart api
```

### Banco de dados não inicializa
```bash
# Resetar banco
docker compose down -v
docker compose up --build
```

### Código não executa
```bash
docker logs sr_runner
# Se não houver logs, pode ser falta de SDKs
docker compose build --no-cache runner
```

---

## Endpoints Essenciais

### Backend

```bash
# Health check
curl http://localhost:4000/health

# Registrar usuário
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Runner

```bash
# Health check
curl http://localhost:3001/health

# Executar Python
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-001",
    "language": "python",
    "code": "print(\"Hello, World!\")"
  }'

# Executar JavaScript
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-002",
    "language": "javascript",
    "code": "console.log(\"Hello, World!\");"
  }'
```

---

## Variáveis de Ambiente

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sourcerank

# Server
PORT=4000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h

# Runner
RUNNER_URL=http://localhost:3001
RUNNER_TIMEOUT=5000

# Logging
LOG_LEVEL=info
```

### Runner (.env)

```env
# Server
PORT=3001
NODE_ENV=development

# Backend
API_URL=http://localhost:4000

# Execution
EXECUTION_TIMEOUT=30000
SANDBOX_DIR=/tmp/executions
MAX_OUTPUT_SIZE=1000000
```

---

## Linguagens Suportadas

| Linguagem | Status | Como Usar |
|-----------|--------|-----------|
| Python | ✅ | `"language": "python"` |
| JavaScript | ✅ | `"language": "javascript"` |
| TypeScript | ✅ | `"language": "typescript"` |
| Java | ✅ | `"language": "java"` |
| Go | ✅ | `"language": "go"` |
| C# | ✅ | `"language": "csharp"` |

---

## Exemplos de Código

### Python
```python
print("Hello, Python!")
result = sum([1, 2, 3, 4, 5])
print(f"Sum: {result}")
```

### JavaScript
```javascript
console.log("Hello, JavaScript!");
const sum = [1, 2, 3, 4, 5].reduce((a, b) => a + b, 0);
console.log("Sum:", sum);
```

### Java
```java
public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, Java!");
    int sum = 0;
    for (int i = 1; i <= 5; i++) sum += i;
    System.out.println("Sum: " + sum);
  }
}
```

### Go
```go
package main
import "fmt"
func main() {
  fmt.Println("Hello, Go!")
  sum := 0
  for i := 1; i <= 5; i++ {
    sum += i
  }
  fmt.Println("Sum:", sum)
}
```

### C#
```csharp
using System;
class Main {
  static void Main() {
    Console.WriteLine("Hello, C#!");
    int sum = 0;
    for (int i = 1; i <= 5; i++) sum += i;
    Console.WriteLine("Sum: " + sum);
  }
}
```

---

## Estrutura de Diretórios

```
sourcerank/
├── backend/               # API Node.js/Express
│   ├── src/
│   │   ├── modules/      # Módulos (auth, users, etc)
│   │   ├── config/       # Configurações
│   │   └── middleware/   # Middleware
│   ├── database/         # PostgreSQL schema
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── runner/                # Code Execution Service
│   ├── src/
│   │   ├── executors/    # Language executors
│   │   ├── sandbox/      # Sandbox management
│   │   └── utils/        # Utilities
│   ├── Dockerfile        # Docker multi-language
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── docker-compose.yml    # (Se desejar usar)
├── PROJECT_STATUS.md     # Status do projeto
└── README.md            # Documentação geral
```

---

## Commands Úteis

### Backend
```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Iniciar em produção
npm start

# Limpar build
npm run clean
```

### Runner
```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Testes
./test.sh

# Iniciar em produção
npm start
```

### Docker
```bash
# Build imagem Backend
docker build -t sourcerank-api:latest ./backend

# Build imagem Runner
docker build -t sourcerank-runner:latest ./runner

# Docker Compose (se configurado)
docker-compose up -d
```

---

## Troubleshooting

### Backend não inicia
```bash
# Verificar PostgreSQL
psql postgresql://localhost/sourcerank

# Verificar variáveis de ambiente
env | grep DATABASE

# Ver logs detalhados
LOG_LEVEL=debug npm run dev
```

### Runner não executa código
```bash
# Verificar se servidor está rodando
curl http://localhost:3001/health

# Executar teste simples
./runner/test.sh

# Ver logs
npm run dev
```

### Erro de conexão entre serviços
```bash
# Verificar se Backend está acessível do Runner
curl http://localhost:4000/health

# Verificar variáveis de ambiente
echo $API_URL
echo $RUNNER_URL
```

---

## Próximos Passos

1. **Explore a Documentação**
   - [Backend Guide](backend/README.md)
   - [Runner Guide](runner/README.md)
   - [Integration Guide](runner/INTEGRATION.md)

2. **Implementar Frontend**
   - React ou Next.js
   - WebSocket client para logs em tempo real
   - Editor de código integrado

3. **Deploy**
   - Docker Compose
   - Kubernetes
   - Cloud (AWS, GCP, Azure)

4. **Production Checklist**
   - Rate limiting
   - Queue system
   - Monitoring
   - CI/CD pipeline
   - Backups

---

## Recursos Úteis

- [Node.js Docs](https://nodejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express Guide](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Docker Docs](https://docs.docker.com/)

---

## 📞 Suporte

Para mais informações:
1. Leia os README.md nos diretórios backend/ e runner/
2. Verifique a documentação específica em cada módulo
3. Execute os testes para validar o funcionamento

---

**Status:** ✅ Pronto para Usar  
**Última Atualização:** Janeiro 2024
