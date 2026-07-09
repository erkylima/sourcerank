# Exemplos de API — SourceRank

Base URL: `http://localhost:4000`

---

## Autenticação

### Registrar usuário
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "entrevistador@example.com",
    "password": "senha123",
    "role": "interviewer",
    "name": "João Silva"
  }'
```

Resposta `201`:
```json
{
  "user": { "id": "uuid...", "email": "entrevistador@example.com", "role": "interviewer" },
  "token": "eyJ..."
}
```

### Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "entrevistador@example.com", "password": "senha123"}'
```

Resposta `200`: mesma estrutura do registro.

### Usuário atual
```bash
TOKEN="eyJ..."
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Desafios

### Listar
```bash
curl "http://localhost:4000/challenges?limit=10&offset=0"
```

Resposta:
```json
{
  "challenges": [
    {
      "id": 1,
      "title": "FizzBuzz",
      "description": "...",
      "difficulty": "basic",
      "code_example": "...",
      "lang_example": "python"
    }
  ],
  "total": 10,
  "limit": 10,
  "offset": 0
}
```

> **Atenção:** `challenges.id` é um **inteiro** (SERIAL), não UUID.

### Criar (apenas interviewer)
```bash
curl -X POST http://localhost:4000/challenges \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Verificar primo",
    "description": "Dado n, retorne true se primo.",
    "difficulty": "basic",
    "codeExample": "def is_prime(n):\n    ...",
    "langExample": "python"
  }'
```

### Casos de teste de um desafio
```bash
curl "http://localhost:4000/challenges/1/examples?limit=5"
```

---

## Sessões

### Entrevistador cria sessão
```bash
curl -X POST http://localhost:4000/sessions/create-interview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Resposta `201`:
```json
{
  "session": {
    "id": "uuid-da-sessao",
    "session_code": "UUID1234",
    "status": "pending",
    "interviewee_accepted": false
  }
}
```

O `session_code` são os primeiros 8 caracteres do UUID em maiúsculas.

### Candidato solicita acesso
```bash
curl -X POST http://localhost:4000/sessions/request-access \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionCode": "UUID1234"}'
```

### Entrevistador aceita candidato
```bash
curl -X PATCH http://localhost:4000/sessions/{sessionId}/accept \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Buscar sessão (polling do candidato)
```bash
curl http://localhost:4000/sessions/{sessionId} \
  -H "Authorization: Bearer $CANDIDATE_TOKEN"
```

Resposta:
```json
{
  "session": {
    "id": "...",
    "interviewee_accepted": true,
    "status": "active",
    "current_challenge_id": 1
  }
}
```

### Atualizar desafio atual
```bash
curl -X PATCH http://localhost:4000/sessions/{sessionId}/challenge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"challengeId": 2}'
```

---

## Execução de código

### Submeter código
```bash
curl -X POST http://localhost:4000/executions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-da-sessao",
    "challengeId": "1",
    "language": "python",
    "code": "n = int(input())\nprint(n * 2)"
  }'
```

Resposta `202`:
```json
{ "execution": { "id": "uuid-execucao", "status": "pending" } }
```

Os logs chegam via WebSocket no evento `execution-log-{executionId}`.

### Logs de uma execução
```bash
curl http://localhost:4000/executions/{executionId}/logs \
  -H "Authorization: Bearer $TOKEN"
```

---

## Conteúdo do editor

### Salvar código
```bash
curl -X POST "http://localhost:4000/session-content/{sessionId}/challenges/{challengeId}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "print(\"hello\")",
    "contentType": "code",
    "language": "python",
    "started": true
  }'
```

### Carregar código
```bash
curl "http://localhost:4000/session-content/{sessionId}/challenges/{challengeId}?contentType=code&language=python" \
  -H "Authorization: Bearer $TOKEN"
```

### Trocar linguagem
```bash
curl -X POST "http://localhost:4000/session-content/{sessionId}/challenges/{challengeId}/change-language" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "java", "contentType": "code"}'
```

Isso move o conteúdo atual para histórico e retorna o conteúdo da nova linguagem (do histórico ou starter).

### Linguagem preferida da sessão
```bash
# Ler
curl "http://localhost:4000/session-content/sessions/{sessionId}/preferred-language" \
  -H "Authorization: Bearer $TOKEN"

# Salvar
curl -X PATCH "http://localhost:4000/session-content/sessions/{sessionId}/preferred-language" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "python"}'
```

---

## WebSocket (Socket.io)

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:4000', {
  auth: { token: 'eyJ...' }
})

// Entrar na sessão (recebe broadcasts de challenge, linguagem, execução)
socket.emit('join-session', 'uuid-da-sessao')

// Receber notificação de que o candidato solicitou acesso (entrevistador)
socket.emit('join-room', `interviewer:${userId}`)
socket.on('candidate-access-request', ({ sessionId, candidateName }) => {
  console.log(`${candidateName} quer entrar`)
})

// Acompanhar execução (logs em tempo real)
socket.emit('join-execution', 'uuid-execucao')
socket.on('execution-log-uuid-execucao', ({ message, level }) => {
  console.log(message)
})
socket.on('execution-completed-uuid-execucao', ({ status, exitCode }) => {
  console.log('Finalizado:', status)
})

// Receber mudança de desafio
socket.on('session-challenge-changed-uuid-da-sessao', ({ index }) => {
  console.log('Novo desafio:', index)
})

// Receber mudança de linguagem
socket.on('session-language-changed-uuid-da-sessao', ({ language }) => {
  console.log('Nova linguagem:', language)
})
```

---

## Códigos HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Criado |
| 202 | Aceito (execução assíncrona) |
| 400 | Dados inválidos |
| 401 | Token ausente ou inválido |
| 403 | Sem permissão (role incorreto) |
| 404 | Recurso não encontrado |
| 500 | Erro interno |

---

## Teste completo via shell

```bash
API="http://localhost:4000"

# Login
RES=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"interviewer@test.com","password":"password123"}')
TOKEN=$(echo $RES | jq -r '.token')

# Criar sessão
SESSION=$(curl -s -X POST "$API/sessions/create-interview" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
SESSION_ID=$(echo $SESSION | jq -r '.session.id')
SESSION_CODE=$(echo $SESSION | jq -r '.session.session_code')
echo "Código: $SESSION_CODE"

# Login candidato
RES2=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"candidate@test.com","password":"password123"}')
TOKEN2=$(echo $RES2 | jq -r '.token')

# Candidato solicita acesso
curl -s -X POST "$API/sessions/request-access" \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d "{\"sessionCode\": \"$SESSION_CODE\"}"

# Entrevistador aceita
curl -s -X PATCH "$API/sessions/$SESSION_ID/accept" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# Verificar (candidato)
curl -s "$API/sessions/$SESSION_ID" -H "Authorization: Bearer $TOKEN2" | jq '.session.interviewee_accepted'
# deve retornar: true
```
