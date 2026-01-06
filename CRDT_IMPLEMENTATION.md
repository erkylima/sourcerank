# SourceRank - CRDT Integration

## O que foi implementado

### 1. **Yjs Relay Service** (`yjs-relay/`)

- Micro-serviço **standalone** em Node.js
- WebSocket em `/yjs?sessionId=...&token=...`
- JWT obrigatório para autenticação
- In-memory Y.Doc por sessão
- Snapshots periódicos (a cada 20 updates)
- Suporte opcional a **S3** para persistência

**Arquivos:**
- `server.js`: relay principal com broadcast e snapshot
- `Dockerfile`: alpine Node.js
- `package.json`: Yjs + WS + JWT + AWS SDK

### 2. **Frontend - CodeEditor Update**

Binding bidirecional Monaco ↔ Y.Text:
- Se `useCrdt=true`: usa Y.Text para sincronização
- Se `useCrdt=false`: usa prop local (Socket.io)
- Observa mudanças em Y.Text e atualiza editor
- Envia updates binários via WebSocket

### 3. **Feature Flag - VITE_ENABLE_CRDT**

```env
# Frontend
VITE_ENABLE_CRDT=false          # Padrão: Socket.io
VITE_YJS_URL=ws://localhost:1234/yjs

# Relay
ENABLE_S3_SNAPSHOT=false        # Padrão: em memória
S3_BUCKET=my-bucket
S3_PREFIX=yjs/
S3_REGION=us-east-1
```

### 4. **Desacoplamento Socket.io**

Quando `ENABLE_CRDT=true`:
- `handleCodeUpdate` retorna early (não processa broadcasts)
- Broadcasting via Socket.io é **desligado**
- Eventos de execução/navegação continuam no Socket.io

### 5. **Documentação**

- `CRDT_GUIDE.md`: guia completo de uso, configuração e troubleshooting
- `test-crdt.sh`: script para teste end-to-end

## Como Usar

### Teste Local (Em Memória)

```bash
docker compose build yjs-relay web api runner
ENABLE_S3_SNAPSHOT=false docker compose up -d

# Ou:
./test-crdt.sh
```

Acesse:
- Frontend: http://localhost:5173
- Yjs relay: ws://localhost:1234/yjs

### Com S3 (Produção)

```env
ENABLE_S3_SNAPSHOT=true
S3_BUCKET=sourcerank-prod
S3_REGION=us-east-1
```

Credenciais AWS via:
```bash
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=yyy
```

### Feature Flag - Desativar CRDT

```env
VITE_ENABLE_CRDT=false  # Volta para Socket.io (padrão)
```

## Trade-offs

### ✅ Prós

- Sincronização sem conflitos (CRDT merges automáticos)
- Tolerância a desconexões (updates se replicam quando reconecta)
- Bidirecional nativo (sem polling)
- Escalável (relay é stateless em relação a usuários)

### ❌ Contras

- +1 serviço (yjs-relay) + persistência (S3 ou DB)
- Updates binários (debugging difícil)
- Snapshots precisam ser gerenciados (compressão, cleanup)
- Overhead de memoria por Y.Doc em memória

## Roadmap

### MVP (Atual)
- [x] Relay in-memory
- [x] Feature flag para ativar/desativar
- [x] S3 snapshots opcionais
- [x] Desacoplamento Socket.io

### Fase 2 (Futuro)
- [ ] Compress snapshots com gzip
- [ ] Endpoint `/session/{id}/code` para query estado
- [ ] Metrics/observabilidade
- [ ] Cursor hints (Y.Map para posição do cursor)
- [ ] Cleanup automático de sessões antigas

### Produção
- [ ] Health check/liveness endpoints
- [ ] Rate limiting
- [ ] Audit logs
- [ ] Backup automático S3 → Glacier

## Segurança

- ✅ JWT obrigatório no WebSocket
- ✅ Validação `canWrite` (apenas interviewer/candidate)
- ✅ Limite 2MB por update
- ✅ Debounce 50–100ms (cliente)

## Arquitetura Final

```
┌─────────────┐      ┌──────────────┐
│  Interview  │      │ Interviewee  │
│  Session    │      │  View        │
│ (React)     │      │ (React)      │
└────────┬────┘      └────────┬─────┘
         │                    │
         │ Y.Text('code')     │
         │ Binary WS          │ Binary WS
         └────────┬───────────┘
                  │
          ┌───────▼────────┐
          │  Yjs Relay     │
          │  (Node.js)     │
          │ /yjs?sessionId │
          │ Y.Doc storage  │
          └───────┬────────┘
                  │
          ┌───────▼────────┐
          │  S3 Snapshots  │ (Opcional)
          │  (Per 20 upd)  │
          └────────────────┘

Plus:
- Socket.io para execução/navegação (unchanged)
- PostgreSQL para persistência de sessões/desafios
- Runner para execução de código
```

## Verificação

Para confirmar CRDT funcionando:

```bash
# 1. Check relay logs
docker logs sr_yjs_relay | grep -E "Connected|update|snapshot"

# 2. Check browser console
# [CodeEditor][CRDT] Connected to relay
# [CodeEditor][CRDT] Failed to apply update (se houver erro)

# 3. Edit código em dois browsers
# Deve sincronizar instantaneamente com merges automáticos
```

## Rollout Plan

**Padrão**: `VITE_ENABLE_CRDT=false` (Socket.io)

Para migrar:
1. Deploy com flag = false (sem mudança de comportamento)
2. Ativar em **staging** com `VITE_ENABLE_CRDT=true`
3. Monitor: latência, taxa de erro, CPU do relay
4. Ativar em **produção** quando estável
5. Remover código Socket.io de broadcast apenas na fase 2

---

**Status**: ✅ **Implementado e pronto para teste**

Comece com:
```bash
./test-crdt.sh
```
