# VARREDURA COMPLETA - ARQUITETURA CRDT & ESTRATÉGIA SIMPLIFICADA

## 1. ESTADO ATUAL DO PROBLEMA

### Sintoma
- Primeiro desafio: Funciona (editor sincroniza)
- Muda para 2º desafio: Para de sincronizar
- Hook está fazendo 5 "fases" complexas com refs, dependencies tangled

### Raiz do Problema
O hook `useChallengeContent` tem **múltiplas camadas de state management** conflitando:

1. **Zustand** (challengeId) 
2. **TanStack Query** (content cache + isLoading)
3. **Refs** (localContentRef, setupQueryKeyRef)
4. **State React** (currentLanguage, isLanguageInitialized)
5. **CRDT Service** (WebSocket subscriptions)

Quando mudadesafio:
```
challengeId muda → useEffect rodam → Query refetch → Refs setados errado → 
CRDT subscribe/unsubscribe conflitam → Sync quebra
```

---

## 2. ARQUITETURA ATUAL (Relay + API)

### Relay (yjs-relay/server.js)
```
✅ FUNCIONA BEM:
- Per-challenge Y.Doc storage
- WebSocket broadcasting
- Snapshot persistence (S3)
- Session management
```

Não tem problemas. **O relay é sólido.**

### API (api/src/modules/crdt/)
```
✅ FUNCIONA:
- Proxy WebSocket (forwards to relay)
- Polling timer (syncs relay→DB every 5s)
- Snapshot tracking
```

Não tem problemas. **A API é confiável.**

### Frontend Hook (useChallengeContent.ts)
```
❌ MUITO COMPLEXO:
- 5+ useEffect orquestrando estado
- Refs conflitando com dependencies
- Query cache + CRDT sync duplicados
- setupQueryKeyRef para evitar re-execute (ainda quebra)
```

**O problema é aqui: organização de estado do front.**

---

## 3. FLUXO ESPERADO vs REAL

### ✅ ESPERADO (1º desafio)
```
Load Challenge 1
  ↓
Query fetch → {content: "", started: true}
  ↓
Phase 2: Check starter → started=true, skip
  ↓
Phase 3: CRDT subscribe → Working
  ↓
User types → updateContent() → publish to CRDT → Relay broadcasts → Other user sees
```

### ❌ REAL (2º desafio)
```
Change Challenge (Zustand: 1→2)
  ↓
[PHASE 1] Reset unsubscribe ✅
  ↓
[INVALIDATION] queryClient.invalidate() ✅ (but not used properly)
  ↓
[Query] Refetch Challenge 2 ✅
  ↓
[PHASE 2] Apply starter ✅
  ↓
[PHASE 3] setupQueryKeyRef not reset properly?
  OR CRDT connection still pointing to Challenge 1?
  OR subscribe() creates new connection but old one still active?
  ↓
❌ No "Setting up real-time sync" log
❌ Updates don't publish
```

---

## 4. PROPOSTA: SIMPLIFICAÇÃO RADICAL

### Estratégia: **"Dump do estado complexo, UI limpa, lógica simples"**

#### A. Remover do Hook
- ❌ Remover todos os Refs (exceto unsubscribeRef)
- ❌ Remover setupQueryKeyRef (tracking muito complexo)
- ❌ Remover Phase 2 (starter logic move para outro lugar)
- ❌ Remover Query cache updates (deixa só fetch)
- ❌ Remover estado de language no hook

#### B. Novo Fluxo Super Simples
```typescript
// NEW useChallengeContent - simples
export function useChallengeContent(sessionId, challengeId) {
  // 1. Load from DB (simple Query)
  const { data } = useQuery({
    queryKey: ['challenge', sessionId, challengeId],
    queryFn: () => repository.load(sessionId, challengeId)
  })

  // 2. Subscribe to CRDT (simple effect)
  useEffect(() => {
    if (!sessionId || !challengeId || !data) return
    
    const unsub = repository.subscribe(sessionId, challengeId, (newContent) => {
      // Callback: CRDT diz "novo conteúdo"
      // Deixa CodeEditor atualizar diretamente (controlled component)
    })
    
    return unsub
  }, [sessionId, challengeId]) // SÓ MUDA SE CHALLENGE MUDA

  // 3. Retorna dados simples
  return { content: data?.content ?? '', isLoading: false }
}
```

#### C. Mover Lógica de Starter
**Para CodeEditor.tsx:**
```typescript
// CodeEditor.tsx
if (content === '' && !started) {
  // Apply starter diretamente no editor
  const starter = getStarter(language)
  editor.setValue(starter)
}
```

Ou **Para um hook separado:**
```typescript
// useApplyStarter.ts - responsabilidade única
export function useApplyStarter(content, started, language) {
  return content === '' && !started 
    ? getStarter(language)
    : content
}
```

#### D. UI Fica Limpa
```typescript
// CodeEditor.tsx
export function CodeEditor({ sessionId, challengeId }) {
  const { content, isLoading } = useChallengeContent(sessionId, challengeId)
  const [editorContent, setEditorContent] = useState(content)
  
  // Apply starter
  const displayContent = useApplyStarter(editorContent, false, language)
  
  return (
    <Editor 
      value={displayContent}
      onChange={(newContent) => {
        setEditorContent(newContent)
        updateContent(newContent)  // Publish to CRDT
      }}
    />
  )
}
```

---

## 5. PLANO DE EXECUÇÃO

### Fase 1: Backup & Análise
1. Commit current state (broken but documented)
2. Create new branch `feature/crdt-simplified`
3. Backup useChallengeContent.ts

### Fase 2: Simplificar Hook
1. **Remove todos os Refs** (exceto unsubscribeRef)
   - Delete: setupQueryKeyRef
   - Delete: localContentRef tracking (CRDT handles echo)
   - Delete: localLanguageRef tracking

2. **Remove Phase 2** (starter logic)
   - Delete: useEffect que aplica starter
   - Delete: setupQueryKey logic

3. **Simplificar dependencies**
   - Phase 1: [sessionId, challengeId, repository]
   - Phase 3: [sessionId, challengeId] (SIMPLES!)
   - Remove: currentLanguage, isLanguageInitialized dependencies

4. **Remove Query cache mutations**
   - Phase 2 que faz setQueryData? DELETE
   - Manter Query fetch simples

### Fase 3: Mover Lógica
1. Criar `web/src/hooks/useApplyStarter.ts`
   - Input: content, started, language
   - Output: content com starter aplicado

2. Atualizar CodeEditor.tsx
   - Use new hook
   - Aplicar starter localmente

### Fase 4: Testar
1. Primeiro desafio: carrega conteúdo
2. Digita: sincroniza em tempo real
3. Muda desafio: novo starter aplicado
4. Digita novo desafio: sincroniza

---

## 6. CÓDIGO NOVO (Draft)

### useChallengeContent.ts - VERSÃO SIMPLIFICADA
```typescript
export function useChallengeContent(
  sessionId: string | undefined,
  challengeId: string | number | undefined,
  contentType: string = 'code',
  options: UseChallengeContentOptions = {}
) {
  const { repository = hybridContentRepository, enableRealtime = true } = options
  const normalizedChallengeId = String(challengeId || '')
  
  // SIMPLES: Query apenas fetch
  const { data, isLoading, error } = useQuery<ChallengeContentData>({
    queryKey: ['challenge-content', sessionId, normalizedChallengeId],
    queryFn: async () => {
      return repository.load(
        sessionId!,
        parseInt(normalizedChallengeId),
        contentType,
        'python' // Default language - Editor handles language switching
      )
    },
    enabled: !!sessionId && !!normalizedChallengeId && normalizedChallengeId !== 'unknown',
  })

  // SIMPLES: Subscribe apenas quando challenge é definido
  const unsubscribeRef = useRef<(() => void) | null>(null)
  
  useEffect(() => {
    if (!sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown' || !enableRealtime) {
      return
    }

    if (!data) {
      return // Wait for data to load
    }

    console.log('[useChallengeContent] Subscribing to CRDT:', { sessionId, normalizedChallengeId })

    const unsub = repository.subscribe(
      sessionId,
      normalizedChallengeId,
      contentType,
      data.language,
      (newContent, newLanguage) => {
        // CRDT diz: "conteúdo mudou"
        // Listener vai atualizar o Editor (detalhe do CodeEditor)
        console.log('[useChallengeContent] CRDT update:', newContent.length, 'chars')
      }
    )

    unsubscribeRef.current = unsub

    return () => {
      unsub()
      unsubscribeRef.current = null
    }
  }, [sessionId, normalizedChallengeId, data, enableRealtime, repository, contentType])

  return {
    content: data?.content ?? '',
    language: data?.language ?? 'python',
    isLoading,
    error,
    updateContent: (content: string) => {
      repository.publish(sessionId!, normalizedChallengeId, contentType, content, data?.language ?? 'python')
    }
  }
}
```

### useApplyStarter.ts - NOVO
```typescript
export function useApplyStarter(
  content: string,
  started: boolean,
  language: string
): string {
  if (content === '' && !started) {
    return starterCodeManager.getStarter(language)
  }
  return content
}
```

### CodeEditor.tsx - ATUALIZADO
```typescript
export function CodeEditor({ sessionId, challengeId }) {
  const { content: dbContent, updateContent } = useChallengeContent(sessionId, challengeId)
  const [editorContent, setEditorContent] = useState(dbContent)
  const [language, setLanguage] = useState('python')
  
  // Apply starter locally
  const displayContent = useApplyStarter(editorContent, false, language)

  const handleChange = (newContent: string) => {
    setEditorContent(newContent)
    updateContent(newContent) // Publish to CRDT
  }

  useEffect(() => {
    setEditorContent(dbContent) // Sync from DB on load
  }, [dbContent])

  return (
    <Editor 
      value={displayContent}
      onChange={handleChange}
    />
  )
}
```

---

## 7. BENEFÍCIOS DESSA ABORDAGEM

| Problema Atual | Solução |
|---|---|
| 5 useEffects tangled | 2 useEffects máximo |
| Refs para tracking | Só Ref para unsubscribe |
| Query cache corrupta | Query só fetch, sem mutate |
| setupQueryKeyRef não funciona | Sem tracking ref (dependencies fazem) |
| Starter em hook | Starter em component (responsabilidade clara) |
| Mudança desafio quebra sync | Simples: deps [sessionId, challengeId] |

---

## 8. RISCO & MITIGAÇÃO

| Risco | Mitigação |
|---|---|
| Perder contexto | Este doc + comments explicam tudo |
| CRDT listener não chama | Testar listener em new hook (isolado) |
| Starter não aplica | Testar useApplyStarter em unit test |
| Performance | Deps claras = Re-renders previsíveis |

---

## 9. PRÓXIMOS PASSOS

1. ✅ Aprovar estratégia (você)
2. ⏳ Implementar Phase 1 (simplificar hook)
3. ⏳ Implementar Phase 2 (mover lógica)
4. ⏳ Testar flow completo
5. ⏳ Deploy

---

## RECOMENDAÇÃO

**Vamos fazer assim:**

1. Eu simplificar `useChallengeContent.ts` → máximo 50 linhas
2. Criar `useApplyStarter.ts` → 10 linhas
3. Atualizar `CodeEditor.tsx` → minimal changes
4. Você testa no browser → deve funcionar

Tempo estimado: **30 minutos**

Quer que eu comece? 👊
