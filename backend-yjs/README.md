# SourceRank Yjs Relay (WebSocket + Persistence)

Este serviço fornece:

- WebSocket relay em `/yjs?sessionId={sessionId}` para transportar updates Yjs binários (Uint8Array)
- Persistência de updates por `sessionId` (arquivo em `backend-yjs/data/{sessionId}.updates`)
- Endpoint HTTP `POST /execute-from-session` para materializar o estado CRDT e delegar execução ao Runner

Características:
- Usa WebSocket exclusivamente (sem WebRTC)
- Não resolve conflitos manualmente — Yjs faz o merge no cliente
- API atua como relay + persistência

Instalação (no diretório `backend-yjs`):

```bash
npm install
npm run build
npm run dev
```

Endpoints:
- WebSocket: `ws://<host>:1234/yjs?sessionId=<sessionId>` (env `PORT` pode alterar)
- HTTP Execute: `POST /execute-from-session` body: `{ sessionId, executionId, language }`

Front-end de exemplo em `frontend/` (index.html + app.js). O front-end conecta no WebSocket e sincroniza um `Y.Doc` que expõe `Y.Text('monaco')`.

Observações de segurança e produção:
- Arquivos de persistência são escritos em texto base64 por update. Para produção, considere usar um storage durável (S3, DB) e compactação incremental de snapshot.
- Para escala horizontal, armazene os updates em um storage compartilhado e reconstitua `Y.Doc` ao conectar.
- O Runner permanece desacoplado da colaboração (somente recebe código materializado no momento da execução).
