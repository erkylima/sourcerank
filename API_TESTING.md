# API Testing Guide

Exemplos de requisições HTTP para testar a API refatorada.

## Autenticação

### Registrar novo usuário (Interviewer)
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "interviewer@example.com",
    "password": "secure_password_123",
    "role": "interviewer",
    "name": "João Silva"
  }'
```

**Resposta:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "interviewer@example.com",
    "role": "interviewer",
    "name": "João Silva",
    "created_at": "2025-01-03T12:00:00Z",
    "updated_at": "2025-01-03T12:00:00Z"
  }
}
```

### Registrar novo usuário (Interviewee)
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@example.com",
    "password": "secure_password_456",
    "role": "interviewee",
    "name": "Maria Santos"
  }'
```

### Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "interviewer@example.com",
    "password": "secure_password_123"
  }'
```

**Resposta:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "interviewer@example.com",
    "role": "interviewer",
    "name": "João Silva"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Obter dados do usuário autenticado
```bash
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer <token>"
```

---

## Desafios

### Listar desafios (público)
```bash
curl -X GET "http://localhost:4000/challenges?limit=10&offset=0"
```

**Resposta:**
```json
{
  "challenges": [
    {
      "id": "uuid-1",
      "title": "Factorial Function",
      "description": "Implement a function to calculate factorial",
      "difficulty": "easy",
      "examples": "{\"input\": \"5\", \"output\": \"120\"}",
      "created_by": "uuid-user",
      "created_at": "2025-01-03T12:00:00Z",
      "updated_at": "2025-01-03T12:00:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### Obter desafio específico
```bash
curl -X GET http://localhost:4000/challenges/uuid-1
```

### Criar novo desafio (interviewer only)
```bash
curl -X POST http://localhost:4000/challenges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Fibonacci Sequence",
    "description": "Implement Fibonacci sequence generator",
    "difficulty": "medium",
    "examples": "{\"input\": \"10\", \"output\": \"[0,1,1,2,3,5,8,13,21,34]\"}"
  }'
```

**Resposta:**
```json
{
  "challenge": {
    "id": "uuid-new",
    "title": "Fibonacci Sequence",
    "description": "Implement Fibonacci sequence generator",
    "difficulty": "medium",
    "examples": "{\"input\": \"10\", \"output\": \"[0,1,1,2,3,5,8,13,21,34]\"}",
    "created_by": "uuid-interviewer",
    "created_at": "2025-01-03T12:00:00Z",
    "updated_at": "2025-01-03T12:00:00Z"
  }
}
```

### Atualizar desafio
```bash
curl -X PUT http://localhost:4000/challenges/uuid-new \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Fibonacci Generator (Updated)",
    "description": "Generate Fibonacci sequence up to n terms"
  }'
```

### Deletar desafio
```bash
curl -X DELETE http://localhost:4000/challenges/uuid-new \
  -H "Authorization: Bearer <token>"
```

---

## Sessões

### Criar sessão de entrevista (interviewer)
```bash
curl -X POST http://localhost:4000/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <interviewer-token>" \
  -d '{
    "intervieweeId": "uuid-candidate",
    "currentChallengeId": "uuid-challenge-1"
  }'
```

**Resposta:**
```json
{
  "session": {
    "id": "uuid-session",
    "interviewer_id": "uuid-interviewer",
    "interviewee_id": "uuid-candidate",
    "current_challenge_id": "uuid-challenge-1",
    "status": "pending",
    "created_at": "2025-01-03T12:00:00Z",
    "updated_at": "2025-01-03T12:00:00Z"
  }
}
```

### Listar sessões do usuário
```bash
curl -X GET http://localhost:4000/sessions \
  -H "Authorization: Bearer <token>"
```

### Obter sessão específica
```bash
curl -X GET http://localhost:4000/sessions/uuid-session \
  -H "Authorization: Bearer <token>"
```

### Atualizar status da sessão
```bash
curl -X PATCH http://localhost:4000/sessions/uuid-session/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "status": "active"
  }'
```

**Status válidos:** `pending`, `active`, `completed`, `cancelled`

### Mudar desafio atual
```bash
curl -X PATCH http://localhost:4000/sessions/uuid-session/challenge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "challengeId": "uuid-challenge-2"
  }'
```

---

## Execução de Código

### Submeter código para execução
```bash
curl -X POST http://localhost:4000/executions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "sessionId": "uuid-session",
    "challengeId": "uuid-challenge",
    "language": "python",
    "code": "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))"
  }'
```

**Status codes:**
- `202 Accepted` - Código aceito para execução
- `400 Bad Request` - Campos inválidos
- `401 Unauthorized` - Token inválido

**Resposta:**
```json
{
  "execution": {
    "id": "uuid-exec",
    "session_id": "uuid-session",
    "challenge_id": "uuid-challenge",
    "language": "python",
    "code": "...",
    "status": "pending",
    "created_at": "2025-01-03T12:00:00Z",
    "updated_at": "2025-01-03T12:00:00Z"
  }
}
```

### Obter status da execução
```bash
curl -X GET http://localhost:4000/executions/uuid-exec \
  -H "Authorization: Bearer <token>"
```

**Resposta (em execução):**
```json
{
  "execution": {
    "id": "uuid-exec",
    "status": "running",
    "stdout": "",
    "stderr": ""
  }
}
```

**Resposta (concluída):**
```json
{
  "execution": {
    "id": "uuid-exec",
    "status": "completed",
    "stdout": "120\n",
    "stderr": "",
    "exit_code": 0,
    "execution_time": 125
  }
}
```

### Obter logs de execução
```bash
curl -X GET http://localhost:4000/executions/uuid-exec/logs \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
  "logs": [
    {
      "id": "uuid-log-1",
      "execution_id": "uuid-exec",
      "message": "Python 3.12.0 starting...",
      "level": "info",
      "created_at": "2025-01-03T12:00:00Z"
    },
    {
      "id": "uuid-log-2",
      "execution_id": "uuid-exec",
      "message": "Execution completed in 125ms",
      "level": "info",
      "created_at": "2025-01-03T12:00:00.125Z"
    }
  ]
}
```

### Obter execuções de uma sessão
```bash
curl -X GET http://localhost:4000/executions/session/uuid-session \
  -H "Authorization: Bearer <token>"
```

---

## WebSocket Connection

### Conectar e ouvir logs em tempo real

```javascript
// JavaScript/TypeScript no frontend
import io from 'socket.io-client'

const socket = io('http://localhost:4000')

// Entrar em uma execução
socket.emit('join-execution', 'uuid-exec-id')

// Escutar logs em tempo real
socket.on('execution-log', (data) => {
  console.log(`[${data.level}] ${data.message}`)
})

// Escutar mudanças de status
socket.on('execution-status', (data) => {
  console.log(`Status: ${data.status}`)
  console.log(`Exit Code: ${data.exitCode}`)
  console.log(`STDOUT: ${data.stdout}`)
})

// Entrar em uma sessão
socket.emit('join-session', 'uuid-session-id')

// Escutar eventos da sessão
socket.on('challenge-changed', (data) => {
  console.log(`New challenge: ${data.challengeId}`)
})

socket.on('session-status', (data) => {
  console.log(`Session status: ${data.status}`)
})
```

---

## Linguagens Suportadas

### Python
```python
def hello():
    print("Hello from Python 3.12")

hello()
```

### JavaScript
```javascript
function hello() {
    console.log("Hello from Node.js 20");
}

hello();
```

### TypeScript
```typescript
function hello(): void {
    console.log("Hello from TypeScript");
}

hello();
```

### Java
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java 21");
    }
}
```

### Go
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello from Go")
}
```

### C#
```csharp
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello from C#");
    }
}
```

---

## Códigos de Erro

| Código | Significado |
|--------|------------|
| 200 | OK |
| 201 | Criado |
| 202 | Aceito |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Não autorizado |
| 404 | Não encontrado |
| 409 | Conflito |
| 500 | Erro interno do servidor |

---

## Environment Variables

```bash
# .env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/interview
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
RUNNER_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```
