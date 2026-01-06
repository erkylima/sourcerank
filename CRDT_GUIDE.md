# Guia de CRDT (Yjs) - SourceRank

## Visão Geral

O SourceRank suporta **CRDT (Conflict-free Replicated Data Type)** via **Yjs** para sincronização de código em tempo real com resolução automática de conflitos.

### Por que CRDT?

- **Sem conflitos**: múltiplos usuários editando simultaneamente se sincronizam de forma determinística
- **Resiliência**: tolerância a desconexões temporárias
- **Baixa latência**: atualizações se propagam quase instantaneamente

### Trade-offs

- **Overhead**: mais infraestrutura (relay Yjs + snapshots)
- **Binário**: updates são binários, aumenta complexidade de debugging
- **Storage**: snapshots periódicos precisam ser persistidos em S3/DB

## Arquitetura

```
Frontend (React)
  └─ Monaco Editor ↔ Y.Text('code') via WebSocket
                      ↓
        [ENABLE_CRDT=true]
                      ↓
    Yjs Relay (yjs-relay service)
      └─ In-memory Y.Doc + persistência S3
      └─ Broadcast updates para todos os clientes
      └─ Snapshots periódicos (a cada N updates)
```

Quando `ENABLE_CRDT=false`: usa Socket.io tradicional (Socket.io broadcasting)

## Habilitação

### 1. Docker Compose

O serviço `yjs-relay` é **opcional**. Adicione ao `docker-compose up`:

```bash
ENABLE_S3_SNAPSHOT=false docker compose up -d
```

### 2. Frontend `.env`

```env
VITE_ENABLE_CRDT=true
VITE_YJS_URL=ws://localhost:1234/yjs
```

Se `VITE_ENABLE_CRDT=false`: usa Socket.io (padrão)

### 3. Backend

Nenhuma mudança necessária no API. O relay é standalone.

## Configuração S3 (Snapshots)

Para persistir snapshots em **S3**:

```env
ENABLE_S3_SNAPSHOT=true
S3_BUCKET=my-bucket
S3_PREFIX=yjs/
S3_REGION=us-east-1
```

O relay deve ter credenciais AWS via:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- Ou `~/.aws/credentials`

**Snapshot interval**: a cada 20 updates (configurável via `SNAPSHOT_INTERVAL`)

### Fallback em Memória

Se S3 não estiver configurado, snapshots ficam **em memória**. Se o relay reinicia, o estado se perde.

Para produção real, use S3 ou banco de dados durável.

## Fluxo de Sincronização

### Cliente A edita código

1. Monaco deteta mudança em `onDidChangeModelContent`
2. Editor transact Y.Text locally: `ytext.delete(0, n)` + `ytext.insert(0, newCode)`
3. Yjs gera `update` binário
4. WebSocket envia `update` para relay

### Relay recebe update

1. Valida token JWT
2. Aplica update ao Y.Doc: `Y.applyUpdate(doc, buffer)`
3. Aumenta contador de updates
4. Se atinge threshold: tira snapshot e persiste em S3
5. Broadcast para todos os **outros** clientes

### Cliente B recebe update

1. Listener `ws.onmessage` recebe binário
2. Aplica localmente: `Y.applyUpdate(ydoc, buffer)`
3. Monaco observa mudança em `ytext.observe()` e atualiza editor
4. Usuário vê código atualizado em tempo real

## Desabilitando Socket.io para código

Quando `ENABLE_CRDT=true`:

- Broadcast via Socket.io é **desligado** (`handleCodeUpdate` retorna early)
- Eventos de **execução** e **navegação de desafio** continuam no Socket.io
- Apenas o editor usa CRDT

## Development

### Rodando localmente

```bash
# Instalar dependências do relay
cd yjs-relay && npm install

# Docker
docker compose up --build

# Ou manualmente
ENABLE_S3_SNAPSHOT=false npm run dev
```

### Debugging

Cheque logs do relay:

```bash
docker logs sr_yjs_relay -f
```

Frontend (Chrome DevTools > Console):

```javascript
// Ver WebSocket messages
const ws = new WebSocket('ws://localhost:1234/yjs?sessionId=test&token=...')
ws.onmessage = (evt) => console.log('update:', evt.data)
```

## Rollout Incrementado

### Fase 1: Staging

```env
VITE_ENABLE_CRDT=true
ENABLE_S3_SNAPSHOT=false  # In-memory para começo
```

Teste sincronização em staging. Se OK, passe para fase 2.

### Fase 2: Persistência

```env
ENABLE_S3_SNAPSHOT=true
S3_BUCKET=prod-bucket
```

Monitore:
- Latência de snapshot
- Consumo S3
- Taxa de erro em `applyUpdate`

### Fase 3: Feature flag por sessão

Futura melhoria: habilitar CRDT apenas para certas sessões.

## Segurança

- **JWT obrigatório** no WebSocket: `?token={jwt}`
- **canWrite check**: apenas interviewer/candidate escrevem
- **Tamanho de update**: limite de 2MB por defecto
- **Rate limiting**: debounce de 50–100ms no cliente

## Troubleshooting

### "Failed to apply update"

- Relay e cliente fora de sinc?
- Versão Yjs incompatível no cliente/relay
- Solução: reinicie relay e navegador

### Snapshots não sendo salvos em S3

- Checar credenciais AWS
- Checar permissões S3 (PutObject)
- Checar `ENABLE_S3_SNAPSHOT=true`
- Logs: `docker logs sr_yjs_relay | grep "persist"`

### Code não sincronizando

- `VITE_ENABLE_CRDT=true`?
- Relay rodando? `docker ps | grep yjs`
- Token válido? Checar JWT_SECRET

## Migrando para CRDT

Se já tem Socket.io funcionando:

1. Set `VITE_ENABLE_CRDT=false` por defecto (fallback)
2. Deploy relay em staging
3. Test com flag ligada
4. Ativar gradualmente por ambiente/sessão

Socket.io e CRDT **coexistem**: apenas editor muda.

## Snapshot & Recovery

Snapshots são **binários Yjs** (não JSON). Contêm estado completo comprimido.

Recovery:
1. Relay inicia
2. Novo cliente conecta
3. Relay envia último snapshot + updates desde então
4. Cliente reconstroi estado idêntico

Para diagnosticar snapshot:

```bash
# Download do S3
aws s3 cp s3://bucket/yjs/sessionId.bin - | xxd | head -20
```

Não é human-readable; é esperado.

## Próximas Melhorias

- [ ] Compress snapshots com gzip
- [ ] Query API: `/session/{id}/code` que reconstrói estado do relay
- [ ] Per-user persistence (user cursors via Y.Map)
- [ ] Metrics: latência, tamanho de update, taxa de erro
- [ ] Health check endpoint no relay

---

**Status**: CRDT é **opcional** e **experimental**. Socket.io continua sendo a padrão.
