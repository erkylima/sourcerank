# SourceRank Runner - Code Execution Service

## 📋 Overview

**Runner** é um serviço isolado responsável pela execução segura de código em múltiplas linguagens de programação. Funciona como microsserviço separado da API principal, executando código enviado em um ambiente sandboxizado com controle de recursos, limites de tempo e segurança.

### Arquitetura

```
┌─────────────────────────────────────────────────┐
│           Backend API (Node.js)                 │
│  - REST API (Express)                           │
│  - WebSocket para notificações                  │
│  - Gerenciamento de desafios                    │
└──────────────┬──────────────────────────────────┘
               │ HTTP Callback (resultado)
               ↓
┌─────────────────────────────────────────────────┐
│      Runner Service (Node.js + TypeScript)      │
│  ┌──────────────────────────────────────────┐   │
│  │  Express Server                          │   │
│  │  - POST /execute                         │   │
│  │  - GET /health                           │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │  Executors (Base + 5 Linguagens)         │   │
│  │  - PythonExecutor                        │   │
│  │  - JavaExecutor                          │   │
│  │  - GoExecutor                            │   │
│  │  - NodeExecutor                          │   │
│  │  - CSharpExecutor                        │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │  Sandbox (Isolamento + Segurança)        │   │
│  │  - Validação de código                   │   │
│  │  - Limites de recursos                   │   │
│  │  - Timeout e Memory limits               │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
       ↓ Docker Container (Isolamento)
┌─────────────────────────────────────────────────┐
│   Sistema Operacional (Linux Alpine)            │
│   - Python 3.12                                 │
│   - Java 21 (OpenJDK)                           │
│   - Go 1.25.5                                   │
│   - Node.js 20                                  │
│   - C# (Mono 6.12)                              │
└─────────────────────────────────────────────────┘
```

## 🎯 Features

### ✅ Linguagens Suportadas
- **Python 3.12** - Execução de scripts Python
- **Java 21** - Compilação e execução de código Java
- **Go 1.25.5** - Execução de binários Go compilados
- **Node.js 20** - Execução de JavaScript e TypeScript
- **C# (Mono 6.12)** - Compilação e execução de código C#

### 🔒 Segurança e Isolamento
- **Sandbox per-execution** - Cada execução ocorre em diretório temporário isolado
- **Validação de código** - Detecção de padrões perigosos (eval, exec, imports maliciosos)
- **Resource limits** - Timeout (30s padrão), Memory limit (512MB)
- **Processo isolado** - Código executa em processo filho separado
- **Cleanup automático** - Limpeza de arquivos temporários pós-execução

### 📊 Monitoramento
- **Health checks** - Endpoint `/health` para verificar status
- **Logging em tempo real** - HTTP callbacks para reportar logs
- **Detecção de timeouts** - Matança automática de processos que excedem limite
- **Error reporting** - Captura de stderr, stdout e exceções

### ⚙️ Features Técnicas
- **Async execution** - Execução não-bloqueante com async/await
- **HTTP callbacks** - Integração com backend via HTTP callbacks
- **Docker support** - Container Alpine multi-language pronto
- **TypeScript strict** - Código compilado com TypeScript strict mode
- **Zero downtime** - Pode ser reiniciado sem impacto

## 🚀 Getting Started

### Pré-requisitos
- Node.js 20+
- npm ou yarn
- Docker (para containerização)
- TypeScript 5.x

### Instalação Local

```bash
# Ir para o diretório do Runner
cd runner

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env conforme necessário

# Compilar TypeScript
npm run build

# Iniciar servidor em desenvolvimento
npm run dev

# Ou iniciar servidor em produção
npm start
```

### Variáveis de Ambiente

```env
# .env
PORT=3001                           # Porta do servidor
NODE_ENV=development               # Ambiente (development/production)
API_URL=http://localhost:4000      # URL da API backend
LOG_LEVEL=info                     # Nível de log (debug/info/warn/error)
EXECUTION_TIMEOUT=30000            # Timeout padrão (ms)
SANDBOX_DIR=/tmp/executions        # Diretório para arquivos temporários
MAX_OUTPUT_SIZE=1000000            # Tamanho máximo de output (bytes)
```

## 📡 API Endpoints

### GET /health
Verifica o status do servidor Runner.

**Request:**
```bash
curl http://localhost:3001/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600.5
}
```

### POST /execute
Executa código em uma linguagem específica.

**Request:**
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "exec-001",
    "language": "python",
    "code": "print(\"Hello, World!\")",
    "timeout": 30000
  }'
```

**Request Body:**
```json
{
  "executionId": "string",           // ID único para a execução
  "language": "string",              // Linguagem: python|javascript|java|go|csharp|typescript
  "code": "string",                  // Código-fonte a executar
  "timeout": 30000                   // Timeout em ms (opcional, default: 30000)
}
```

**Response (202 Accepted):**
```json
{
  "executionId": "exec-001",
  "status": "accepted",
  "message": "Code execution started"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Missing required fields: executionId, language, code"
}
```

### Resposta de Execução (HTTP Callback)

Após a execução, o Runner faz HTTP callback para a API backend:

**POST {API_URL}/executions/{executionId}/complete**

```json
{
  "executionId": "exec-001",
  "status": "completed",
  "language": "python",
  "exitCode": 0,
  "output": {
    "stdout": "Hello, World!\n",
    "stderr": ""
  },
  "executionTime": 145,
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

## 🧪 Testing

### Teste Manual com curl

```bash
# Python
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-py-001",
    "language": "python",
    "code": "print(\"Hello Python\")\nprint(2 + 2)"
  }'

# JavaScript
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-js-001",
    "language": "javascript",
    "code": "console.log(\"Hello JavaScript\");\nconsole.log(2 + 2);"
  }'

# Java
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-java-001",
    "language": "java",
    "code": "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello Java\");\n    System.out.println(\"2 + 2 = \" + (2 + 2));\n  }\n}"
  }'
```

### Script de Teste Automático

```bash
# Executar teste completo
chmod +x test.sh
./test.sh
```

## 🐳 Docker

### Build da Imagem

```bash
# Build local
docker build -t sourcerank-runner:latest .

# Com tag de versão
docker build -t sourcerank-runner:1.0.0 .
```

### Executar Container

```bash
# Desenvolvimento
docker run -it -p 3001:3001 \
  -e API_URL=http://host.docker.internal:4000 \
  sourcerank-runner:latest

# Produção
docker run -d -p 3001:3001 \
  -e NODE_ENV=production \
  -e API_URL=http://api:4000 \
  --restart unless-stopped \
  sourcerank-runner:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  runner:
    build: ./runner
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - API_URL=http://api:4000
      - PORT=3001
    depends_on:
      - api
    restart: unless-stopped

  api:
    build: ./api
    ports:
      - "4000:4000"
    restart: unless-stopped
```

## 📁 Estrutura de Arquivos

```
runner/
├── src/
│   ├── server.ts                 # Servidor Express principal
│   ├── executors/
│   │   ├── base.executor.ts      # Classe base abstrata
│   │   ├── python.executor.ts    # Executor para Python
│   │   ├── java.executor.ts      # Executor para Java
│   │   ├── go.executor.ts        # Executor para Go
│   │   ├── node.executor.ts      # Executor para Node.js/TypeScript
│   │   └── csharp.executor.ts    # Executor para C#
│   ├── sandbox/
│   │   └── sandbox.ts            # Gerenciamento de sandbox
│   └── utils/
│       └── execution.utils.ts    # Utilitários de execução
├── dist/                         # Output compilado (TypeScript → JavaScript)
├── Dockerfile                    # Docker image definition
├── entrypoint.sh                 # Script de inicialização Docker
├── package.json                  # Dependências do projeto
├── tsconfig.json                 # Configuração TypeScript
├── .env                          # Variáveis de ambiente
├── .env.example                  # Template de variáveis
└── README.md                     # Este arquivo
```

## 🔧 Desenvolvimento

### Scripts npm

```bash
# Build do TypeScript
npm run build

# Iniciar em modo desenvolvimento (ts-node-dev)
npm run dev

# Iniciar servidor em produção
npm start

# Limpar build anterior
npm run clean
```

### Estrutura de Classes

#### BaseExecutor (Classe Abstrata)

```typescript
abstract class BaseExecutor {
  abstract getFileExtension(): string
  abstract getExecuteCommand(filePath: string): string
  
  async execute(code: string, tempDir: string, timeout: number): Promise<ExecutionResult>
  protected async executeFile(filePath: string, timeout: number): Promise<ExecutionResult>
}
```

#### Executors Implementados

- **PythonExecutor** - Usa `python3` diretamente
- **JavaExecutor** - Compila com `javac` e executa com `java`
- **GoExecutor** - Compila com `go build` e executa binário
- **NodeExecutor** - Executa `.js` com `node` ou `.ts` com `ts-node`
- **CSharpExecutor** - Compila com `mcs` (Mono) e executa com `mono`

#### Sandbox Class

```typescript
class Sandbox {
  static async createSandbox(executionId: string): Promise<string>
  static async destroySandbox(tempDir: string): Promise<void>
  static validateCode(code: string, language: string): { valid: boolean; reason?: string }
  static enforceResourceLimits(childProcess: ChildProcess, timeout: number): void
}
```

#### ExecutionUtils Class

```typescript
class ExecutionUtils {
  static commandExists(command: string): boolean
  static getInstalledLanguages(): LanguageInfo[]
  static getDiskUsage(path: string): Promise<number>
  static cleanupTempFiles(maxAge?: number): Promise<number>
  static formatOutput(output: string, maxLength: number): string
}
```

## 🎓 Exemplos de Uso

### Python - Fibonacci

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(f"fib(10) = {fibonacci(10)}")
```

### JavaScript - Processamento de Array

```javascript
const numbers = [1, 2, 3, 4, 5];
const squared = numbers.map(n => n * n);
const sum = squared.reduce((a, b) => a + b, 0);
console.log(`Array: ${numbers}`);
console.log(`Squared: ${squared}`);
console.log(`Sum: ${sum}`);
```

### Java - Ordenação

```java
import java.util.Arrays;

public class Main {
  public static void main(String[] args) {
    int[] numbers = {5, 2, 8, 1, 9};
    Arrays.sort(numbers);
    System.out.println("Sorted: " + Arrays.toString(numbers));
  }
}
```

### Go - Goroutines

```go
package main
import (
  "fmt"
  "time"
)

func main() {
  for i := 1; i <= 3; i++ {
    go func(n int) {
      time.Sleep(time.Second)
      fmt.Printf("Goroutine %d done\n", n)
    }(i)
  }
  time.Sleep(2 * time.Second)
}
```

### C# - LINQ

```csharp
using System;
using System.Linq;

public class Program {
  public static void Main() {
    int[] numbers = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
    var evenSquares = numbers
      .Where(n => n % 2 == 0)
      .Select(n => n * n)
      .ToList();
    
    foreach (var num in evenSquares) {
      Console.WriteLine(num);
    }
  }
}
```

## 🚨 Error Handling

### Possíveis Erros

| Código | Erro | Causa |
|--------|------|-------|
| 400 | Missing required fields | Campos obrigatórios não enviados |
| 400 | Unsupported language | Linguagem não suportada |
| 400 | Code validation failed | Código contém padrões perigosos |
| 500 | Execution error | Erro durante execução |
| 504 | Timeout exceeded | Execução ultrapassou timeout |

### Códigos de Saída

- `0` - Execução bem-sucedida
- `1-255` - Erro na execução (código de saída do programa)
- `-1` - Timeout (processo matado)
- `-2` - Erro de memória/recurso

## 📊 Performance

### Benchmarks Típicos

| Linguagem | "Hello World" | Fibonacci(20) | Primes até 1000 |
|-----------|---------------|---------------|-----------------|
| Python    | ~100ms        | ~2500ms       | ~150ms          |
| JavaScript| ~80ms         | ~1800ms       | ~100ms          |
| Java      | ~150ms        | ~500ms        | ~50ms           |
| Go        | ~20ms         | ~100ms        | ~15ms           |
| C#        | ~100ms        | ~800ms        | ~80ms           |

*Tempos podem variar conforme hardware e carga do sistema*

## 🔐 Segurança

### Validações de Código

#### Python
- Detecta: `eval()`, `exec()`, `__import__()`, `open()`, `os.system()`
- Permite: Operações básicas, loops, condicionais, funções

#### JavaScript
- Detecta: `eval()`, `Function()`, `require()` (em sandbox)
- Permite: Operações básicas, loops, promises, `console.log()`

#### Java
- Detecta: `System.exit()`, reflexão perigosa
- Permite: Operações padrão, classes core

#### Go
- Detecta: Imports de `os`, `exec`, `net`
- Permite: Apenas código compilado seguro

#### C#
- Detecta: Reflexão, P/Invoke, acesso a sistema
- Permite: Código managed seguro

## 🐛 Troubleshooting

### Runner não inicia
```bash
# Verificar variáveis de ambiente
env | grep API_URL

# Verificar se porta está em uso
lsof -i :3001

# Ver logs detalhados
LOG_LEVEL=debug npm run dev
```

### Código não executa
```bash
# Verificar se linguagem é suportada
curl http://localhost:3001/health

# Testar com código simples
echo 'print("test")' | curl -X POST ... -d '{"code": ...}'

# Verificar sandbox directory
ls -la /tmp/executions/
```

### Timeout frequente
- Aumentar `EXECUTION_TIMEOUT` em `.env`
- Verificar carga do sistema
- Otimizar código do usuário

### Erro de memória
- Reduzir `MAX_OUTPUT_SIZE`
- Limitar operações em memory
- Aumentar disponibilidade de RAM

## 📝 Logging

O Runner usa console.log para logging estruturado:

```
[INFO] 23:02:00 Server running on http://localhost:3001
[INFO] 23:02:15 Starting Python execution...
[INFO] 23:02:16 Execution completed in 145ms
[DEBUG] Cleanup completed, freed 1.2MB
[ERROR] Execution failed for exec-001: Timeout exceeded
```

## 📚 Recursos Adicionais

- [Node.js Documentation](https://nodejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)

## 📄 License

Este projeto é parte do SourceRank Interview Platform.

## 👥 Contributing

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório.

## 📞 Support

Para suporte técnico, contate a equipe de desenvolvimento.

---

**Última atualização:** Janeiro 2024  
**Versão:** 1.0.0  
**Status:** ✅ Production Ready
