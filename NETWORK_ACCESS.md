# 📱 Acesso na Rede - SourceRank Interview Platform

## 🔗 URLs de Acesso

### Da Máquina Local (localhost)
- **Frontend:** http://localhost:5173
- **API:** http://localhost:4000
- **Code Runner:** http://localhost:3001

### De Outro Dispositivo na Rede (Celular, Tablet, etc)
- **Frontend:** http://192.168.1.12:5173
- **API:** http://192.168.1.12:4000
- **Code Runner:** http://192.168.1.12:3001

---

## 📋 Credenciais de Teste

### Entrevistador
- **Email:** interviewer@test.com
- **Senha:** password123
- **Role:** interviewer

### Candidato
- **Email:** candidate@test.com
- **Senha:** password123
- **Role:** interviewee

---

## 🚀 Endpoints da API

### Autenticação
```bash
# Login
POST /auth/login
Content-Type: application/json

{
  "email": "candidate@test.com",
  "password": "password123"
}

# Registro
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@test.com",
  "password": "password123",
  "name": "User Name",
  "role": "interviewee"
}

# Obter dados do usuário logado
GET /auth/me
Authorization: Bearer {token}
```

### Desafios
```bash
# Listar desafios
GET /challenges
Authorization: Bearer {token}

# Resposta:
{
  "challenges": [
    {
      "id": "uuid",
      "title": "Challenge Name",
      "description": "...",
      "difficulty": "easy",
      "language": "python"
    }
  ],
  "total": 3,
  "limit": 10,
  "offset": 0
}
```

### Execução de Código
```bash
# Submeter código para execução
POST /executions
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionId": "uuid",
  "challengeId": "uuid",
  "language": "python",
  "code": "print('Hello, World!')"
}

# Obter status de execução
GET /executions/{executionId}
Authorization: Bearer {token}

# Obter logs de execução
GET /executions/{executionId}/logs
Authorization: Bearer {token}
```

---

## 🧪 Teste via cURL (Python com script)

```bash
# 1. Fazer login para obter token
TOKEN=$(curl -s -X POST http://192.168.1.12:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate@test.com","password":"password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Listar desafios
curl -s -X GET http://192.168.1.12:4000/challenges \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.challenges[0]'

# 3. Executar Python script
curl -s -X POST http://192.168.1.12:4000/executions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "challengeId": "516d00b2-792b-4cbf-a7f3-f8d2f4b8e47d",
    "language": "python",
    "code": "print(\"Acesso via rede funciona!\")"
  }' | jq '.'
```

---

## ⚠️ Importante

### 1. Firewall
Certifique-se de que sua máquina permite conexões dos ports:
- **5173** (Frontend)
- **4000** (API)
- **3001** (Runner)

### 2. IP Local
O IP **192.168.1.12** pode variar dependendo de sua rede. Para verificar:
```bash
hostname -I  # Linux/macOS
ipconfig     # Windows
```

### 3. Mesma Rede
Certifique-se de que o dispositivo está na mesma rede WiFi/LAN que a máquina host.

### 4. Containers Rodando
Verifique se todos os containers estão rodando:
```bash
docker ps
```

---

## ✅ Validação

### Testar Frontend (Celular)
1. Abra o navegador do celular
2. Digite: `http://192.168.1.12:5173`
3. Você verá a tela de login/registro
4. Use as credenciais acima para testar

### Testar API (Celular/Terminal)
```bash
curl -s http://192.168.1.12:4000/health | jq '.'
```

Esperado:
```json
{
  "status": "ok",
  "timestamp": "2026-01-03T03:15:00.000Z"
}
```

---

## 🆘 Troubleshooting

### "Connection refused"
- Verifique se os containers estão rodando: `docker ps`
- Reinicie os containers: `docker compose restart`

### "Invalid IP"
- Verifique o IP correto: `hostname -I`
- Substitua 192.168.1.12 pelo IP correto

### "CORS Error"
- O CORS já está configurado para aceitar qualquer origem
- Se ainda tiver erro, verifique se a API está rodando

### "Token inválido"
- Faça login novamente e obtenha um novo token
- Tokens expiram em 24 horas

