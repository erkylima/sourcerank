# 🚀 Quick Start Guide - SourceRank

## 5 Minutos para Começar

### 1. Backend API

```bash
# Entrar no diretório
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações de banco

# Iniciar servidor
npm run dev
```

✅ Backend rodando em `http://localhost:4000`

### 2. Runner Service

```bash
# Entrar no diretório (em outro terminal)
cd runner

# Instalar dependências
npm install

# Iniciar servidor
npm run dev
```

✅ Runner rodando em `http://localhost:3001`

### 3. Testar

```bash
# Terminal 3
cd runner

# Executar testes
chmod +x test.sh
./test.sh
```

✅ Todos os endpoints testados

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
