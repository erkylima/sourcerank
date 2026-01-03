# Exemplos de Uso da API SourceRank

## 1. Autenticação

### Registro de novo usuário

```bash
curl -X POST http://localhost:4000/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidato@example.com",
    "password": "senha123",
    "role": "interviewee"
  }'
```

**Resposta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "candidato@example.com",
    "role": "interviewee"
  }
}
```

### Login

```bash
curl -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidato@example.com",
    "password": "senha123"
  }'
```

## 2. Desafios

### Listar todos os desafios

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl http://localhost:4000/challenges \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta:**
```json
[
  {
    "id": 1,
    "title": "Somar dois números",
    "description": "Leia dois inteiros separados por espaço e imprima a soma.",
    "inputExample": "2 3",
    "outputExample": "5"
  },
  {
    "id": 2,
    "title": "Fatorial (iterativo)",
    "description": "Calcule o fatorial de um número n (0 <= n <= 12).",
    "inputExample": "5",
    "outputExample": "120"
  }
]
```

### Editar desafio (apenas entrevistador)

```bash
curl -X PUT http://localhost:4000/challenges/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Somar dois números (MODIFICADO)",
    "description": "Leia dois inteiros e calcule a soma.",
    "inputExample": "10 20",
    "outputExample": "30"
  }'
```

### Criar novo desafio (apenas entrevistador)

```bash
curl -X POST http://localhost:4000/challenges \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Verificar se é primo",
    "description": "Leia um número e imprima 'Sim' se for primo, 'Não' caso contrário.",
    "inputExample": "7",
    "outputExample": "Sim"
  }'
```

## 3. Execução de Código

### Executar código Python

```bash
curl -X POST http://localhost:4000/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "a, b = map(int, input().split())\nprint(a + b)",
    "sessionId": "session-123"
  }'
```

**Resposta:**
```json
{
  "sessionId": "session-123"
}
```

Os logs serão transmitidos via WebSocket na sessão.

### Executar código Java

```bash
curl -X POST http://localhost:4000/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "java",
    "code": "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int a = sc.nextInt();\n    int b = sc.nextInt();\n    System.out.println(a + b);\n  }\n}",
    "sessionId": "session-456"
  }'
```

### Executar código Go

```bash
curl -X POST http://localhost:4000/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "go",
    "code": "package main\nimport (\"fmt\")\nfunc main() {\n  var a, b int\n  fmt.Scan(&a, &b)\n  fmt.Println(a + b)\n}",
    "sessionId": "session-789"
  }'
```

### Executar código JavaScript

```bash
curl -X POST http://localhost:4000/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "node",
    "code": "const readline = require(\"readline\");\nconst rl = readline.createInterface({ input: process.stdin });\nrl.on(\"line\", (line) => {\n  const [a, b] = line.split(\" \").map(Number);\n  console.log(a + b);\n});",
    "sessionId": "session-js"
  }'
```

### Executar código TypeScript

```bash
curl -X POST http://localhost:4000/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "ts",
    "code": "const a: number = 2;\nconst b: number = 3;\nconsole.log(a + b);",
    "sessionId": "session-ts"
  }'
```

### Executar código C#

```bash
curl -X POST http://localhost:4000/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "csharp",
    "code": "using System;\nclass Program {\n  static void Main() {\n    var nums = Console.ReadLine().Split(\" \");\n    int a = int.Parse(nums[0]);\n    int b = int.Parse(nums[1]);\n    Console.WriteLine(a + b);\n  }\n}",
    "sessionId": "session-cs"
  }'
```

## 4. WebSocket (Socket.io)

### Conectar ao servidor

```javascript
import io from 'socket.io-client'

const socket = io('http://localhost:4000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
})

socket.on('connect', () => {
  console.log('Conectado!')
})
```

### Juntar-se a uma sessão de logs

```javascript
socket.emit('join-session', 'session-123')
```

### Receber logs em tempo real

```javascript
socket.on('log', (payload) => {
  console.log('Log recebido:', payload.data)
  // payload.sessionId = 'session-123'
  // payload.data = 'output do programa'
})
```

### WebRTC Signaling - Enviar oferta

```javascript
socket.emit('webrtc-offer', {
  target: 'peer-id',
  sdp: {
    type: 'offer',
    sdp: '...'
  }
})
```

### WebRTC Signaling - Receber oferta

```javascript
socket.on('webrtc-offer', (payload) => {
  console.log('Oferta recebida de:', payload.from)
  const sdp = payload.sdp
  // Processar SDP e criar resposta
})
```

### WebRTC Signaling - Enviar resposta

```javascript
socket.emit('webrtc-answer', {
  target: 'peer-id',
  sdp: {
    type: 'answer',
    sdp: '...'
  }
})
```

### WebRTC Signaling - Enviar ICE candidate

```javascript
socket.emit('webrtc-candidate', {
  target: 'peer-id',
  candidate: {
    candidate: 'candidate:...',
    sdpMLineIndex: 0,
    sdpMid: '0'
  }
})
```

### WebRTC Signaling - Receber ICE candidate

```javascript
socket.on('webrtc-candidate', (payload) => {
  console.log('Candidate recebido de:', payload.from)
  const candidate = payload.candidate
  // Adicionar ICE candidate ao peer connection
})
```

## 5. Exemplo Completo (Frontend)

```typescript
import io, { Socket } from 'socket.io-client'

const API_URL = 'http://localhost:4000'

async function runCode() {
  const token = localStorage.getItem('access_token')
  const sessionId = `session-${Date.now()}`
  
  // Conectar ao Socket.io
  const socket: Socket = io(API_URL, {
    auth: { token }
  })
  
  socket.on('connect', () => {
    console.log('Conectado!')
    
    // Juntar-se à sessão
    socket.emit('join-session', sessionId)
    
    // Receber logs
    socket.on('log', (payload) => {
      console.log(payload.data)
    })
  })
  
  // Fazer requisição de execução
  const response = await fetch(`${API_URL}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      language: 'python',
      code: 'print("Hello, World!")',
      sessionId
    })
  })
  
  const result = await response.json()
  console.log('Execução iniciada:', result.sessionId)
}
```

## Codes de Erro HTTP

| Código | Significado |
|--------|------------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido/ausente |
| 403 | Forbidden - Sem permissão (role) |
| 404 | Not Found - Recurso não encontrado |
| 500 | Internal Server Error - Erro do servidor |

## Exemplo com JavaScript Puro

```javascript
// Login
const loginResponse = await fetch('http://localhost:4000/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'teste@example.com',
    password: '123'
  })
})

const { access_token } = await loginResponse.json()
localStorage.setItem('access_token', access_token)

// Listar desafios
const response = await fetch('http://localhost:4000/challenges', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
})

const challenges = await response.json()
console.log(challenges)

// Executar código
const runResponse = await fetch('http://localhost:4000/run', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    language: 'python',
    code: 'print(2 + 2)',
    sessionId: 'sess-123'
  })
})

const execution = await runResponse.json()
console.log('Sessão:', execution.sessionId)
```

---

Para mais informações, veja [README.md](README.md) e [DEVELOPMENT.md](DEVELOPMENT.md)
