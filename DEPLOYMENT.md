# Guia de Deployment e Troubleshooting

## Verificar Instalação

### 1. Verificar Docker
```bash
docker --version
docker compose --version
```

Esperado: versões recentes (Docker 24+, Compose 2.20+)

### 2. Limpar Containers Anteriores
```bash
docker compose down -v
```

### 3. Build Completo
```bash
docker compose up --build
```

## Troubleshooting

### Problema: "Failed to pull image" ou erro de network

**Solução:**
```bash
docker network prune
docker compose pull
docker compose up --build
```

### Problema: Runner não consegue instalar SDKs

**Sintoma:** Build falha no `runner` Dockerfile

**Solução 1:** Trocar mirror de apt (se no Brasil):
```dockerfile
# Adicione ao runner/Dockerfile antes de apt-get update:
RUN sed -i 's/archive.ubuntu.com/br.archive.ubuntu.com/g' /etc/apt/sources.list
RUN apt-get update
```

**Solução 2:** Instalar SDKs separadamente:
```bash
# Entrar no container
docker exec -it sr_runner bash

# Instalar Python
apt-get update && apt-get install -y python3.12

# Verificar
python3.12 --version
```

### Problema: Frontend não carrega

**Sintoma:** Erro 404 ou página em branco

**Verificar:**
```bash
# Logs do container
docker logs sr_web

# Verificar porta
docker ps | grep sr_web

# Acessar
curl http://localhost:5173
```

### Problema: API retorna 401 (Unauthorized)

**Sintoma:** "Token required" ao fazer requisições

**Solução:** Certificar que o token é enviado:
```bash
# No frontend, verificar localStorage
# Abrir DevTools > Application > Local Storage > http://localhost:5173
# Deve ter: access_token=eyJ...
```

### Problema: Logs não aparecem no terminal

**Sintoma:** Clica "Run" mas não vê saída

**Verificar:**
```bash
# 1. Verificar conexão Socket.io
# Abrir DevTools > Network > WS (WebSocket)
# Deve haver conexão ativa

# 2. Testar runner direto
docker exec sr_runner npm start

# 3. Testar execução de código Python manualmente
docker exec sr_runner python3 -c "print('Teste')"
```

### Problema: Erro CORS

**Sintoma:** "Access to XMLHttpRequest has been blocked by CORS policy"

**Verificar:** Arquivo `api/index.js` linha com `cors()`:
```javascript
app.use(cors());  // Deve estar presente
```

### Problema: Container ocupa muita memória

**Sintoma:** Sistema fica lento após rodar alguns testes

**Solução:** Adicionar limites no `docker-compose.yml`:
```yaml
services:
  runner:
    mem_limit: 512m
    memswap_limit: 512m
```

## Monitoramento

### Ver logs em tempo real
```bash
# Todos os containers
docker compose logs -f

# Apenas API
docker compose logs -f api

# Apenas Runner
docker compose logs -f runner

# Apenas Web
docker compose logs -f web
```

### Inspecionar container
```bash
docker exec -it sr_api sh
docker exec -it sr_runner bash
docker exec -it sr_web sh
```

### Verificar recursos
```bash
docker stats
```

## Performance

### Otimizar build (desenvolvedor)

Se fizer mudanças frequentes, use volumes:
```bash
# Na docker-compose.yml, adicione ao serviço desejado:
volumes:
  - ./api:/app
```

### Forçar rebuild de uma layer específica
```bash
docker compose build --no-cache api
```

## Segurança em Produção

### 1. Mudar JWT_SECRET
```bash
export JWT_SECRET="seu-secret-aleatorio-super-seguro"
docker compose up
```

### 2. Usar HTTPS
```bash
# Instalar certificado Let's Encrypt
# Configurar nginx reverse proxy
# Mapear porta 443
```

### 3. Limitar execução de código
```javascript
// No runner/index.js, adicionar timeout:
const timeoutHandle = setTimeout(() => {
  p.kill()
  emitLog(sessionId, 'Execução excedeu tempo limite\n')
}, 10000) // 10 segundos
```

### 4. Sandboxing
```dockerfile
# No runner/Dockerfile, criar usuário sem privilégios:
RUN useradd -m -u 1000 coderunner
USER coderunner
```

## Deployment em Produção

### Opção 1: VPS com Docker

```bash
# SSH para servidor
ssh user@seu-servidor.com

# Clonar repositório
git clone seu-repo sourcerank
cd sourcerank

# Configurar variáveis de ambiente
cat > .env << EOF
JWT_SECRET=seu-secret-production
API_URL=https://api.seu-dominio.com
VITE_API_URL=https://api.seu-dominio.com
EOF

# Rodar
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Opção 2: Kubernetes

```yaml
# deployment.yml (exemplo simplificado)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sourcerank-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sourcerank-api
  template:
    metadata:
      labels:
        app: sourcerank-api
    spec:
      containers:
      - name: api
        image: sourcerank-api:latest
        ports:
        - containerPort: 4000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: sourcerank-secrets
              key: jwt-secret
```

### Opção 3: Heroku/Render

```bash
# Criar heroku.yml
cat > heroku.yml << EOF
build:
  docker:
    api: api/Dockerfile
    runner: runner/Dockerfile
    web: web/Dockerfile
EOF

# Deploy
git push heroku main
```

## Backup & Restore

### Backup da data (challenges.json)
```bash
docker cp sr_api:/app/challenges.json ./backup-challenges-$(date +%Y%m%d).json
```

### Restore
```bash
docker cp ./backup-challenges-20240102.json sr_api:/app/challenges.json
```

## Rollback

```bash
# Se um build quebrou, voltar ao anterior
docker compose down
git checkout HEAD~1  # ou tag anterior
docker compose up
```

## Checklist de Launch

- [ ] JWT_SECRET alterado
- [ ] HTTPS configurado
- [ ] Rate limiting implementado
- [ ] Logging e monitoring ativo
- [ ] Backup automatizado
- [ ] Timeouts de execução configurados
- [ ] Limites de memória/CPU definidos
- [ ] Política de CORS revisada
- [ ] Variáveis de env. em `.env` (não hardcoded)
- [ ] Testes de carga realizados
- [ ] Documentação atualizada
- [ ] Equipe treinada

---

Para mais informações, veja [README.md](./README.md)
