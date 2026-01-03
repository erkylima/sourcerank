# Code Runner Service - SourceRank

Serviço isolado responsável pela execução segura de código em múltiplas linguagens.

## 🎯 Características

- ✅ **5 Linguagens Suportadas:** Python 3.12, Java 21, Go 1.25.5, Node.js 20, C# (Mono)
- ✅ **Sandbox Seguro:** Execução isolada em diretórios temporários
- ✅ **Limites de Recursos:** Timeout (30s), memória, CPU
- ✅ **Captura de Output:** stdout, stderr, exit code
- ✅ **Logs em Tempo Real:** HTTP POST callbacks para API
- ✅ **Compilação Automática:** Linguagens compiladas compiladas quando necessário
- ✅ **Cleanup:** Limpeza de processos órfãos e arquivos temporários
- ✅ **Health Checks:** Verificação de status contínua

## 🏗️ Arquitetura

```
runner/
├── src/
│   ├── server.ts                    # Express server
│   ├── executors/
│   │   ├── base.executor.ts        # Classe base
│   │   ├── python.executor.ts
│   │   ├── java.executor.ts
│   │   ├── go.executor.ts
│   │   ├── node.executor.ts
│   │   └── csharp.executor.ts
│   ├── sandbox/
│   │   └── sandbox.ts              # Isolamento e validação
│   └── utils/
│       └── execution.utils.ts      # Utilitários gerais
├── Dockerfile                       # Multi-language image
├── entrypoint.sh                   # Inicialização
├── package.json
├── tsconfig.json
├── .env
└── .env.example
```

## 🚀 Como Executar

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Compilar TypeScript
npm run build

# Iniciar com hot reload
npm run dev

# Verificar tipos
npm run typecheck
```

### Docker

```bash
# Build
docker build -t sourcerank-runner .

# Run
docker run -p 3001:3001 \
  -e API_URL=http://localhost:4000 \
  -v /tmp/executions:/tmp/executions \
  sourcerank-runner
```

### Docker Compose

```bash
docker-compose up runner
```

## 📡 API Endpoints

### Health Check
```
GET /health

Resposta:
{
  "status": "ok",
  "timestamp": "2025-01-03T12:00:00Z",
  "uptime": 123.45
}
```

### Execute Code
```
POST /execute

Body:
{
  "executionId": "uuid-string",
  "language": "python|javascript|typescript|java|go|csharp",
  "code": "# code here",
  "timeout": 30000
}

Resposta (202 Accepted):
{
  "executionId": "uuid-string",
  "status": "accepted",
  "message": "Code execution started"
}
```

## 📝 Fluxo de Execução

1. **Recepção**: POST `/execute` com código e linguagem
2. **Validação**: Verificar sintaxe e padrões perigosos
3. **Sandbox**: Criar diretório isolado em `/tmp/executions/{id}`
4. **Compilação**: Compilar se necessário (Java, C#, Go)
5. **Execução**: Rodar com timeout e limites de recursos
6. **Captura**: Obter stdout, stderr, exit code
7. **Callback**: HTTP POST para `API_URL/executions/{id}/report`
8. **Cleanup**: Remover arquivos temporários

## 🔐 Segurança

### Isolamento
- Diretório temporário privado por execução
- Permissões restritas (755)
- UID/GID específico para execução

### Restrições
- ⏱️ **Timeout**: 30 segundos (configurável)
- 💾 **Memória**: 512MB limite
- 🚫 **Rede**: Sem acesso a internet
- 🔒 **Filesystem**: Acesso apenas ao sandbox

### Detecção de Código Perigoso
- `eval()`, `exec()`, `__import__` (Python)
- `System.Diagnostics.Process` (C#)
- `os.Exec` (Go)
- `require()` (Node.js)
- `Runtime.getRuntime()` (Java)

## 🌐 Linguagens Suportadas

### Python 3.12
```python
print("Hello from Python 3.12")
x = 5 + 3
print(f"Result: {x}")
```

### JavaScript (Node.js 20)
```javascript
console.log("Hello from Node.js 20");
const x = 5 + 3;
console.log(`Result: ${x}`);
```

### TypeScript
```typescript
const message: string = "Hello from TypeScript";
console.log(message);
const x: number = 5 + 3;
console.log(`Result: ${x}`);
```

### Java 21
```java
public class Code {
    public static void main(String[] args) {
        System.out.println("Hello from Java 21");
        int x = 5 + 3;
        System.out.println("Result: " + x);
    }
}
```

### Go 1.25.5
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello from Go")
    x := 5 + 3
    fmt.Printf("Result: %d\n", x)
}
```

### C# (Mono)
```csharp
public class Program {
    static void Main() {
        System.Console.WriteLine("Hello from C#");
        int x = 5 + 3;
        System.Console.WriteLine($"Result: {x}");
    }
}
```

## 📊 Estrutura de Resposta

### Sucesso
```json
{
  "executionId": "exec-123",
  "status": "completed",
  "stdout": "Hello from Python\nResult: 8\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 125
}
```

### Erro
```json
{
  "executionId": "exec-123",
  "status": "failed",
  "stdout": "",
  "stderr": "SyntaxError: invalid syntax",
  "exitCode": 1,
  "executionTime": 50
}
```

### Timeout
```json
{
  "executionId": "exec-123",
  "status": "timeout",
  "stdout": "Partial output...",
  "stderr": "Process killed due to timeout",
  "exitCode": 124,
  "executionTime": 30000
}
```

## 🔧 Configuração

### Variáveis de Ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORT` | 3001 | Porta do servidor |
| `NODE_ENV` | development | Ambiente (development/production) |
| `API_URL` | http://localhost:4000 | URL da API backend |
| `SANDBOX_TIMEOUT` | 30000 | Timeout em ms (max 60000) |
| `SANDBOX_MAX_MEMORY` | 512m | Limite de memória |
| `SANDBOX_MAX_CPU` | 2 | Cores CPU alocados |
| `SANDBOX_TEMP_DIR` | /tmp/executions | Diretório temporário |
| `LOG_LEVEL` | info | Nível de log |
| `DEBUG` | false | Debug mode |

## 📈 Performance

### Tempos Típicos de Execução

| Linguagem | Startup | Execução Simples |
|-----------|---------|-----------------|
| Python | 100ms | 50ms |
| JavaScript | 50ms | 30ms |
| TypeScript | 200ms | 80ms |
| Java | 300ms | 100ms |
| Go | 50ms | 40ms |
| C# | 200ms | 70ms |

## 🐛 Troubleshooting

### "Command not found: python3"
```bash
docker build --build-arg INSTALL_PYTHON=1 .
```

### Memory limit exceeded
```
Aumentar SANDBOX_MAX_MEMORY ou reduzir timeout
```

### Processos órfãos não limpam
```bash
docker exec runner pkill -9 -f "java|python|go"
```

## 📚 Exemplos de Uso

### Via cURL
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-123",
    "language": "python",
    "code": "print(\"Hello World\")",
    "timeout": 30000
  }'
```

### Via JavaScript/Node.js
```javascript
import axios from 'axios'

const response = await axios.post('http://localhost:3001/execute', {
  executionId: 'test-123',
  language: 'javascript',
  code: 'console.log("Hello World")',
  timeout: 30000
})

console.log(response.data)
// { executionId: 'test-123', status: 'accepted', ... }
```

## 🎓 Padrões de Implementação

### Criar novo executor
```typescript
import { BaseExecutor, ExecutionResult } from './base.executor'

export class MyLanguageExecutor extends BaseExecutor {
  protected getFileExtension(): string {
    return '.ext'
  }

  protected getExecuteCommand(filePath: string): string {
    return `mylang run "${filePath}"`
  }
}
```

### Adicionar ao registry
```typescript
executors['mylanguage'] = new MyLanguageExecutor()
```

## 🚀 Deployment

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sourcerank-runner
spec:
  replicas: 3
  selector:
    matchLabels:
      app: runner
  template:
    metadata:
      labels:
        app: runner
    spec:
      containers:
      - name: runner
        image: sourcerank-runner:latest
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
```

## 📝 Logs

```
Exemplo de log de execução:

Starting Python execution...
Language: python
Timeout: 30000ms
[INFO] Code compiled successfully
[INFO] Execution started
[INFO] Execution completed in 125ms
[INFO] Stderr: 
Execution completed in 125ms
```

## 🔗 Integração com API

O Runner comunica com a API via HTTP:

1. **Recebe requisições** em `POST /execute`
2. **Envia logs** em `POST /executions/{id}/logs`
3. **Reporta resultados** em `POST /executions/{id}/report`

---

**Versão:** 1.0.0  
**Última atualização:** 2025-01-03  
**Status:** Production Ready
