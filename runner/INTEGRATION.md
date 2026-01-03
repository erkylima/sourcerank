// INTEGRATION.md - Documentação de Integração Runner com Backend API

# 🔗 Integração Runner ↔ API Backend

## Overview

Este documento descreve como o Runner Service se integra com a API Backend para executar código de forma assíncrona.

## Fluxo de Execução

```
┌────────────┐
│   Cliente  │
└─────┬──────┘
      │ POST /challenges/:id/submit
      ↓
┌──────────────────┐
│  Backend API     │
├──────────────────┤
│ 1. Valida código │
│ 2. Cria record   │
│    de execução   │
│ 3. Envia HTTP    │
│    POST para     │
│    Runner        │
└─────┬────────────┘
      │ HTTP POST /execute
      ↓
┌──────────────────┐
│  Runner Service  │
├──────────────────┤
│ 1. Valida código │
│ 2. Cria sandbox  │
│ 3. Executa       │
│ 4. Captura output│
└─────┬────────────┘
      │ HTTP POST /executions/:id/complete
      ↓
┌──────────────────┐
│  Backend API     │
├──────────────────┤
│ 1. Recebe result │
│ 2. Salva output  │
│ 3. Atualiza      │
│    execution     │
│ 4. Notifica      │
│    cliente       │
└──────────────────┘
```

## 1. Backend → Runner: POST /execute

O Backend envia requisição para o Runner com o código a executar.

### Request

```http
POST http://localhost:3001/execute
Content-Type: application/json

{
  "executionId": "exec-20240115-001",
  "language": "python",
  "code": "def sum(a, b):\n    return a + b\n\nprint(f\"3 + 5 = {sum(3, 5)}\")",
  "timeout": 30000
}
```

### Request Fields

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `executionId` | string | ✅ | ID único da execução (PK na API) |
| `language` | string | ✅ | Linguagem: python \| javascript \| java \| go \| csharp \| typescript |
| `code` | string | ✅ | Código-fonte completo |
| `timeout` | number | ❌ | Timeout em ms (default: 30000) |

### Response

O Runner retorna **202 Accepted** imediatamente (execução assíncrona):

```json
{
  "executionId": "exec-20240115-001",
  "status": "accepted",
  "message": "Code execution started"
}
```

## 2. Runner → Backend: POST /executions/{executionId}/complete

Após completar a execução, o Runner faz callback para reportar resultado.

### Request

```http
POST http://localhost:4000/executions/exec-20240115-001/complete
Content-Type: application/json

{
  "executionId": "exec-20240115-001",
  "status": "completed",
  "language": "python",
  "exitCode": 0,
  "output": {
    "stdout": "3 + 5 = 8\n",
    "stderr": ""
  },
  "executionTime": 145,
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Request Fields

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `executionId` | string | ID da execução (deve corresponder ao enviado) |
| `status` | string | Status final: "completed" \| "error" \| "timeout" |
| `language` | string | Linguagem que foi executada |
| `exitCode` | number | Código de saída (0 = sucesso, 1-255 = erro, -1 = timeout) |
| `output.stdout` | string | Output padrão |
| `output.stderr` | string | Erros da execução |
| `executionTime` | number | Tempo de execução em ms |
| `timestamp` | string | Data/hora ISO8601 |

### Response Esperada

Backend deve responder com 200 OK:

```json
{
  "success": true,
  "message": "Execution result saved"
}
```

## 3. Implementação no Backend

### Model Execution (TypeScript)

```typescript
// backend/src/modules/execution/models/execution.model.ts

export interface Execution {
  id: string                    // UUID
  executionId: string           // ID enviado para Runner
  challengeId: string           // ID do desafio
  userId: string                // ID do usuário
  language: string              // Linguagem usada
  code: string                  // Código-fonte
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout'
  output: {
    stdout: string
    stderr: string
  }
  exitCode: number | null
  executionTime: number | null  // ms
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}
```

### Service (Executar Código)

```typescript
// backend/src/modules/execution/services/execution.service.ts

export class ExecutionService {
  async submitCode(
    userId: string,
    challengeId: string,
    language: string,
    code: string
  ): Promise<Execution> {
    // 1. Validar código
    if (!this.validateCode(code, language)) {
      throw new BadRequestException('Invalid code')
    }

    // 2. Criar record no DB
    const execution: Execution = {
      id: uuidv4(),
      executionId: `exec-${Date.now()}-${Math.random()}`,
      challengeId,
      userId,
      language,
      code,
      status: 'pending',
      output: { stdout: '', stderr: '' },
      exitCode: null,
      executionTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    }

    // 3. Salvar no banco
    await this.executionRepository.save(execution)

    // 4. Enviar para Runner
    await this.sendToRunner(execution)

    return execution
  }

  private async sendToRunner(execution: Execution): Promise<void> {
    const runnerUrl = process.env.RUNNER_URL || 'http://localhost:3001'
    
    try {
      const response = await axios.post(`${runnerUrl}/execute`, {
        executionId: execution.executionId,
        language: execution.language,
        code: execution.code,
        timeout: 30000,
      }, {
        timeout: 5000,
      })

      console.log(`[Execution] Sent to Runner: ${execution.executionId}`)

      // Atualizar status para 'running'
      execution.status = 'running'
      execution.updatedAt = new Date()
      await this.executionRepository.save(execution)
    } catch (error) {
      console.error(`[Execution] Failed to send to Runner: ${error.message}`)
      
      execution.status = 'error'
      execution.output.stderr = `Failed to send to Runner: ${error.message}`
      execution.updatedAt = new Date()
      execution.completedAt = new Date()
      await this.executionRepository.save(execution)
    }
  }

  private validateCode(code: string, language: string): boolean {
    // Implementar validações específicas por linguagem
    // Retornar false se código for suspeito
    return true
  }
}
```

### Controller (Endpoint de Callback)

```typescript
// backend/src/modules/execution/controllers/execution.controller.ts

@Controller('executions')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post(':executionId/complete')
  async completeExecution(
    @Param('executionId') executionId: string,
    @Body() result: ExecutionResultDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.executionService.saveExecutionResult(executionId, result)
      
      return {
        success: true,
        message: 'Execution result saved',
      }
    } catch (error) {
      console.error(`[Execution] Error saving result: ${error.message}`)
      
      throw new InternalServerErrorException(
        'Failed to save execution result'
      )
    }
  }
}

export class ExecutionResultDto {
  executionId: string
  status: 'completed' | 'error' | 'timeout'
  language: string
  exitCode: number
  output: {
    stdout: string
    stderr: string
  }
  executionTime: number
  timestamp: string
}
```

### Service (Salvar Resultado)

```typescript
// backend/src/modules/execution/services/execution.service.ts

async saveExecutionResult(
  executionId: string,
  result: ExecutionResultDto,
): Promise<void> {
  // 1. Encontrar execution
  const execution = await this.executionRepository.findOne({
    where: { executionId },
  })

  if (!execution) {
    throw new NotFoundException(`Execution ${executionId} not found`)
  }

  // 2. Atualizar com resultado
  execution.status = result.status === 'completed' && result.exitCode === 0 
    ? 'completed' 
    : result.status

  execution.output = result.output
  execution.exitCode = result.exitCode
  execution.executionTime = result.executionTime
  execution.completedAt = new Date(result.timestamp)
  execution.updatedAt = new Date()

  // 3. Salvar no DB
  await this.executionRepository.save(execution)

  // 4. Verificar se passou em testes (se aplicável)
  await this.checkTestResults(execution)

  // 5. Notificar usuário via WebSocket
  this.socketGateway.notifyExecutionComplete(
    execution.userId,
    execution.id,
    execution.status,
  )
}

private async checkTestResults(execution: Execution): Promise<void> {
  // Lógica para verificar se output atende aos requisitos
  // Exemplo: executar testes contra output
  
  if (execution.status === 'completed') {
    // Verificar se output corresponde ao esperado
    // Atualizar challenge submission status
  }
}
```

## 4. Configuração de Variáveis de Ambiente

### Backend (.env)

```env
# Runner Service
RUNNER_URL=http://localhost:3001
RUNNER_TIMEOUT=5000              # Timeout para fazer request ao Runner

# Execution
EXECUTION_TIMEOUT=30000          # Timeout padrão de execução
MAX_OUTPUT_SIZE=1000000          # Tamanho máximo de output (bytes)
MAX_EXECUTIONS_PER_HOUR=100      # Limite de execuções por hora/usuário
```

### Runner (.env)

```env
# Servidor
PORT=3001
NODE_ENV=development

# Backend
API_URL=http://localhost:4000
API_TIMEOUT=5000                 # Timeout para fazer request à API

# Execution
EXECUTION_TIMEOUT=30000
SANDBOX_DIR=/tmp/executions
MAX_OUTPUT_SIZE=1000000
```

## 5. Tratamento de Erros

### Cenários de Erro

#### 1️⃣ Runner Indisponível

```typescript
// Backend: Se Runner não responder
{
  status: 'error',
  exitCode: -999,
  output: {
    stdout: '',
    stderr: 'Runner service unavailable',
  }
}
```

#### 2️⃣ Timeout

```typescript
// Runner: Se código exceder timeout
{
  status: 'timeout',
  exitCode: -1,
  output: {
    stdout: 'Partial output...',
    stderr: 'Execution timeout (30s exceeded)',
  }
}
```

#### 3️⃣ Erro de Compilação

```typescript
// Runner: Se houver erro ao compilar (Java, Go, C#)
{
  status: 'error',
  exitCode: 1,
  output: {
    stdout: '',
    stderr: 'Main.java:5: error: cannot find symbol',
  }
}
```

#### 4️⃣ Erro de Validação

```typescript
// Runner: Se código for rejeitado na validação
{
  status: 'error',
  exitCode: 400,
  output: {
    stdout: '',
    stderr: 'Code validation failed: dangerous pattern detected',
  }
}
```

## 6. Retry Logic (Backend)

```typescript
async function executeWithRetry(
  execution: Execution,
  maxRetries: number = 3,
) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.sendToRunner(execution)
      return
    } catch (error) {
      lastError = error
      console.warn(`[Execution] Attempt ${attempt}/${maxRetries} failed`)

      if (attempt < maxRetries) {
        // Esperar antes de retry (exponential backoff)
        await new Promise((resolve) => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
  }

  // Se falhar em todas tentativas
  throw new Error(`Failed to execute after ${maxRetries} attempts: ${lastError?.message}`)
}
```

## 7. Monitoramento e Logging

### Backend Logs

```
[INFO] [ExecutionService] Received execution request
  - executionId: exec-20240115-001
  - challengeId: ch-123
  - language: python

[INFO] [ExecutionService] Sent to Runner
  - executionId: exec-20240115-001
  - status: running

[INFO] [ExecutionController] Received execution result
  - executionId: exec-20240115-001
  - status: completed
  - exitCode: 0
  - executionTime: 145ms
```

### Runner Logs

```
[INFO] Starting Python execution...
[DEBUG] Sandbox created: /tmp/executions/exec-20240115-001
[DEBUG] Code written to: /tmp/executions/exec-20240115-001/code.py
[INFO] Execution completed in 145ms
[DEBUG] Sandbox cleanup completed
```

## 8. Testing

### Unit Test: ExecutionService

```typescript
describe('ExecutionService', () => {
  let service: ExecutionService
  let repository: Repository<Execution>

  beforeEach(() => {
    // Setup
  })

  it('should send code to Runner', async () => {
    const result = await service.submitCode(
      'user-123',
      'challenge-456',
      'python',
      'print("test")',
    )

    expect(result.status).toBe('pending')
    expect(result.executionId).toBeDefined()
  })

  it('should handle Runner timeout', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('Timeout'))

    const result = await service.submitCode(
      'user-123',
      'challenge-456',
      'python',
      'print("test")',
    )

    expect(result.status).toBe('error')
  })
})
```

### Integration Test: Full Flow

```typescript
describe('Execution Flow (Integration)', () => {
  it('should execute Python code end-to-end', async () => {
    // 1. Backend submits code
    const execution = await executionService.submitCode(
      'user-123',
      'challenge-456',
      'python',
      'print("Hello")',
    )

    expect(execution.status).toBe('pending')

    // 2. Runner executes
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 3. Runner sends result
    const result = {
      status: 'completed',
      exitCode: 0,
      output: { stdout: 'Hello\n', stderr: '' },
      executionTime: 45,
      timestamp: new Date().toISOString(),
    }

    await executionController.completeExecution(
      execution.executionId,
      result,
    )

    // 4. Verify result saved
    const saved = await executionRepository.findOne(execution.id)
    expect(saved.status).toBe('completed')
    expect(saved.output.stdout).toBe('Hello\n')
  })
})
```

## 9. Performance Considerations

### Tuning

```env
# Aumentar se houver muitas execuções simultâneas
RUNNER_POOL_SIZE=5

# Reduzir timeout padrão para execuções rápidas
EXECUTION_TIMEOUT=15000

# Limitar tamanho de output grande
MAX_OUTPUT_SIZE=500000
```

### Scaling

Para múltiplas instâncias de Runner:

```yaml
# docker-compose.yml
version: '3.8'
services:
  runner1:
    build: ./runner
    environment:
      - INSTANCE_ID=runner-1
    ports:
      - "3001:3001"

  runner2:
    build: ./runner
    environment:
      - INSTANCE_ID=runner-2
    ports:
      - "3002:3001"

  load-balancer:
    image: nginx
    ports:
      - "3000:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

## 10. Troubleshooting

### Runner não executa código

1. Verificar health:
   ```bash
   curl http://localhost:3001/health
   ```

2. Verificar configuração do Backend:
   ```bash
   echo $RUNNER_URL
   ```

3. Verificar se código passou na validação:
   ```bash
   curl -X POST http://localhost:3001/execute \
     -d '{"executionId":"test","language":"python","code":"print(1)"}'
   ```

### Backend não recebe callback

1. Verificar firewall/networking:
   ```bash
   curl -v http://localhost:4000/executions/test/complete
   ```

2. Verificar endpoint no Backend:
   ```bash
   grep -r "completeExecution" backend/src/
   ```

3. Adicionar logging:
   ```typescript
   console.log('[Runner] Calling:', `${apiUrl}/executions/${executionId}/complete`)
   ```

---

**Última atualização:** Janeiro 2024
