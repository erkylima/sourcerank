# 📖 Índice de Documentação - SourceRank

## 🚀 Começar Aqui

### 1. [README.md](README.md) - **LEIA PRIMEIRO**
   - Visão geral do projeto
   - Stack técnico completo
   - Como rodar com Docker
   - Credenciais de teste
   - Funcionalidades principais

### 2. [STRUCTURE.md](STRUCTURE.md) - Arquitetura
   - Estrutura completa de pastas
   - Fluxo de dados visual
   - Endpoints da API
   - Tecnologias utilizadas
   - Requisitos de sistema

---

## 👨‍💻 Para Desenvolvedores

### 3. [DEVELOPMENT.md](DEVELOPMENT.md) - Guia de Dev
   - Setup local (sem Docker)
   - Estrutura de código
   - Como adicionar componentes
   - Adicionar novas linguagens
   - Adicionar persistência
   - Debugging

### 4. [API_EXAMPLES.md](API_EXAMPLES.md) - Exemplos de Uso
   - Exemplos de requisições HTTP
   - Exemplos WebSocket/Socket.io
   - Exemplo completo de fluxo
   - JavaScript puro
   - Codes de erro

---

## 🏭 Para Produção

### 5. [DEPLOYMENT.md](DEPLOYMENT.md) - Produção
   - Verificação de instalação
   - Troubleshooting detalhado
   - Monitoramento
   - Performance
   - Segurança em produção
   - Deployment options (VPS, Kubernetes, Heroku)
   - Backup & Restore
   - Checklist de launch

---

## ✅ Gerenciamento

### 6. [CHECKLIST.md](CHECKLIST.md) - Status
   - Lista de funcionalidades implementadas
   - Funcionalidades pendentes
   - Integrações futuras
   - Resumo de status

---

## 📋 Sumário Rápido

| Seção | Arquivo | Objetivo | Para Quem |
|-------|---------|----------|----------|
| Começar | README.md | Overview + Setup | Todos |
| Arquitetura | STRUCTURE.md | Entender estrutura | Devs + Leads |
| Desenvolvimento | DEVELOPMENT.md | Guia prático | Devs |
| Exemplos | API_EXAMPLES.md | Usar a API | Devs |
| Produção | DEPLOYMENT.md | Deploy + Debug | DevOps/Leads |
| Status | CHECKLIST.md | Track progress | PMs/Leads |

---

## 🎯 Por Caso de Uso

### "Quero subir a aplicação agora"
1. Leia: [README.md](README.md) seção "Como Rodar"
2. Execute: `./start.sh` ou `docker compose up --build`
3. Acesse: http://localhost:5173

### "Quero entender a arquitetura"
1. Leia: [STRUCTURE.md](STRUCTURE.md)
2. Visualize: Fluxo de dados e endpoints
3. Estude: Componentes e serviços

### "Quero adicionar uma feature"
1. Leia: [DEVELOPMENT.md](DEVELOPMENT.md)
2. Verifique: Exemplos de adicionar linguagem/desafio
3. Consulte: [API_EXAMPLES.md](API_EXAMPLES.md)

### "Preciso fazer deploy em produção"
1. Leia: [DEPLOYMENT.md](DEPLOYMENT.md) - Segurança
2. Siga: Checklist de launch
3. Configure: Monitoramento e backup

### "A aplicação não funciona"
1. Verifique: [DEPLOYMENT.md](DEPLOYMENT.md) - Troubleshooting
2. Consulte: Logs (`docker logs sr_api`)
3. Debug: [DEVELOPMENT.md](DEVELOPMENT.md) - Debugging

### "Quero ver exemplos de uso da API"
1. Acesse: [API_EXAMPLES.md](API_EXAMPLES.md)
2. Copy-paste: Exemplos com curl/JavaScript
3. Teste: No seu cliente HTTP favorito

---

## 📊 Árvore de Leitura Recomendada

```
┌─ README.md (visão geral)
│
├─ 🤔 "Como funciona?" ──→ STRUCTURE.md
│
├─ 👨‍💻 "Vou desenvolver" ──→ DEVELOPMENT.md
│                        └─ API_EXAMPLES.md (para integrar)
│
└─ 🚀 "Vou fazer deploy" ──→ DEPLOYMENT.md
                        └─ CHECKLIST.md (antes de launch)
```

---

## 🔗 Links Rápidos

- **Frontend**: http://localhost:5173
- **API**: http://localhost:4000
- **Docker Compose**: Ver [docker-compose.yml](docker-compose.yml)

---

## 📞 Suporte

### Se encontrar erro:
1. Buscar em [DEPLOYMENT.md](DEPLOYMENT.md) > Troubleshooting
2. Verificar logs: `docker logs sr_api` / `sr_runner` / `sr_web`
3. Consultar [DEVELOPMENT.md](DEVELOPMENT.md) > Debugging

### Se quiser adicionar feature:
1. Consultar [DEVELOPMENT.md](DEVELOPMENT.md)
2. Seguir exemplos em [API_EXAMPLES.md](API_EXAMPLES.md)
3. Atualizar [CHECKLIST.md](CHECKLIST.md) quando pronto

### Se quiser atualizar documentação:
- Editar arquivo `.md` correspondente
- Manter consistência com estrutura
- Atualizar este índice se necessário

---

## 📝 Versionamento de Docs

| Versão | Data | Notas |
|--------|------|-------|
| 1.0 | 2 Jan 2026 | Versão inicial completa (MVP) |

---

## ✨ Dicas Úteis

- Sempre comece pelo [README.md](README.md)
- Use `Ctrl+F` para buscar palavras-chave nos docs
- Cada arquivo `.md` é autoexplicativo e pode ser lido independentemente
- Exemplos em [API_EXAMPLES.md](API_EXAMPLES.md) podem ser copiados diretamente

---

**Última atualização**: 2 de janeiro de 2026

Bom desenvolvimento! 🚀
