# Modelagem de Dados - SourceRank

Esquema completo do banco de dados PostgreSQL 16.

## 📊 Diagrama Entidade-Relacionamento

```
users
  ├─ id (UUID) [PK]
  ├─ email (VARCHAR) [UNIQUE]
  ├─ password_hash (VARCHAR)
  ### starter_codes

  Templates de código inicial genéricos para cada linguagem suportada.

  ```sql
  CREATE TABLE starter_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(50) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

  **Campos:**
  - `id`: UUID único
  - `language`: Linguagem
  - `content`: Template de código inicial
  - `created_at`, `updated_at`: Timestamps

  **Exemplo de starter genérico:**
  ```python
  # Python
  ├─ id (UUID) [PK]
  ├─ session_id (FK sessions)
  ├─ challenge_id (FK challenges)
  ├─ content_type (code|notes)
  ├─ language
  ├─ content (TEXT)
  ```
  ```javascript
  // JavaScript
  function solution(args) {
  └─ updated_at

executions
  ├─ id (UUID) [PK]
  ```
  ```java
  // Java
  public class Solution {
  ├─ session_id (FK sessions)
  ├─ language
  ├─ code
  ├─ status (pending|running|completed|error)
  ├─ output
  ├─ error
  ├─ execution_time_ms
  ├─ created_at
  └─ updated_at
  ```
  ```go
  // Go
  func solution(args interface{}) interface{} {
     ↓
     └─→ logs

logs
  ├─ id (UUID) [PK]
  ├─ challenge_id (FK challenges)
  ├─ language
  ```
  ```typescript
  // TypeScript
  function solution(args: any): any {
  ├─ content (TEXT)
  ### users

Armazena dados de autenticação e perfil dos usuários.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('interviewer', 'interviewee')),
  name VARCHAR(255),
  ```
  ```csharp
  // C#
  public class Solution {
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

**Campos:**
- `id`: UUID único gerado automaticamente
  ```
- `email`: Email único do usuário (login)
- `password_hash`: Senha hasheada com bcrypt
- `role`: Entrevistador ou candidato
- `name`: Nome completo do usuário
- `created_at`: Timestamp de criação
- `updated_at`: Última atualização

---

### challenges

Desafios de programação disponíveis no sistema.

```sql
CREATE TABLE challenges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty VARCHAR(50) NOT NULL CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  code_example TEXT NOT NULL,
  lang_example VARCHAR(50) NOT NULL DEFAULT 'python',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_challenges_created_by ON challenges(created_by);
```

**Campos:**
- `id`: ID sequencial auto-incremento
- `title`: Nome do desafio (ex: "Two Sum")
- `description`: Descrição completa do problema
- `difficulty`: Nível de dificuldade
- `code_example`: Código de referência funcional (obrigatório)
- `lang_example`: Linguagem do code_example (ex: python, javascript, java...)
- `created_by`: Referência para usuário criador
- `created_at`, `updated_at`: Timestamps

---

### challenges_evaluations

Casos de teste e avaliações para cada desafio.

```sql
CREATE TABLE challenges_evaluations (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  input_example TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_challenge_eval_challenge_id ON challenges_evaluations(challenge_id);
```

**Campos:**
- `id`: ID sequencial auto-incremento
- `challenge_id`: FK para challenges
- `input_example`: Exemplo de entrada
- `expected_output`: Saída esperada (gerada via code_example)
- `description`: Descrição do caso de teste
- `created_at`: Timestamp

**Desafios Pré-configurados:**
1. FizzBuzz
2. Two Sum
3. Reverse String
4. Palindrome Number
5. Valid Parentheses
6. Binary Search
7. Longest Substring Without Repeating Characters
8. Merge K Sorted Lists
9. Median of Two Sorted Arrays
10. Regular Expression Matching

---

### sessions

Sessões de entrevista entre entrevistador e candidato.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interviewee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
  preferred_language VARCHAR(50) DEFAULT 'python',
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
  session_code VARCHAR(20),
  interviewee_accepted BOOLEAN DEFAULT false,
  interviewee_requested_at TIMESTAMP,
  expires_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_interviewer ON sessions(interviewer_id);
CREATE INDEX idx_sessions_interviewee ON sessions(interviewee_id);
```

**Campos:**
- `id`: UUID único da sessão
- `interviewer_id`: Usuário entrevistador
- `interviewee_id`: Usuário candidato (nullable, pode ser convidado anônimo)
- `current_challenge_id`: Desafio atualmente em uso
- `preferred_language`: Linguagem padrão (python|javascript|java|go|typescript|csharp)
- `status`: Estado da sessão
  - `pending`: Aguardando aceitação do candidato
  - `active`: Entrevista em andamento
  - `completed`: Entrevista finalizada
  - `cancelled`: Cancelada
  - `expired`: Expirada por timeout
- `session_code`: Código único compartilhável com candidato
- `interviewee_accepted`: Flag se candidato aceitou
- `interviewee_requested_at`: Timestamp do convite
- `expires_at`: Data/hora de expiração
- `started_at`, `ended_at`: Datas de início/fim
- `created_at`, `updated_at`: Timestamps

---

### session_challenge_content

Armazena código/conteúdo do usuário para cada desafio em cada sessão.

```sql
CREATE TABLE session_challenge_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL DEFAULT 'python',
  content TEXT NOT NULL DEFAULT '',
  started BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_session_challenge_content UNIQUE (session_id, challenge_id, content_type)
);

CREATE INDEX idx_session_challenge_content_session ON session_challenge_content(session_id);
CREATE INDEX idx_session_challenge_content_challenge ON session_challenge_content(challenge_id);
CREATE INDEX idx_session_challenge_content_lookup ON session_challenge_content(session_id, challenge_id, content_type);
```

**Campos:**
- `id`: UUID único
- `session_id`: Referência para sessão
- `challenge_id`: Referência para desafio
- `content_type`: Tipo de conteúdo (code|notes)
- `language`: Linguagem do código
- `content`: Texto do código ou notas
- `started`: Flag se o usuário começou a editar (não é starter code)
- `created_at`, `updated_at`: Timestamps

**Restrição UNIQUE:** Garante que existe apenas um conteúdo por (session, challenge, content_type)

---

### session_challenge_content_history

Histórico de versões anteriores de código para recuperação.

```sql
CREATE TABLE session_challenge_content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_history_session ON session_challenge_content_history(session_id);
CREATE INDEX idx_content_history_challenge ON session_challenge_content_history(challenge_id);
CREATE INDEX idx_content_history_lookup ON session_challenge_content_history(session_id, challenge_id, content_type, language);
CREATE INDEX idx_content_history_updated ON session_challenge_content_history(updated_at DESC);
```

**Propósito:** Manter histórico quando:
- Usuário muda de linguagem
- Usuário muda de desafio
- Usuário recarrega página

**Campos:** Similares a `session_challenge_content`, mas sem constraint UNIQUE

---

### starter_codes

Templates de código inicial para cada linguagem e desafio.

```sql
CREATE TABLE starter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_starter_code UNIQUE (challenge_id, language)
);

CREATE INDEX idx_starter_codes_challenge ON starter_codes(challenge_id);
CREATE INDEX idx_starter_codes_lookup ON starter_codes(challenge_id, language);
```

**Campos:**
- `challenge_id`: Desafio
- `language`: Linguagem
- `content`: Template de código

**Templates Pré-configurados:**
```python
# Python
def solution(args):
    pass

# JavaScript
function solution(args) {
  // Your code here
}

# Java
public class Solution {
  public static Object solution(Object args) {
    return null;
  }
}

# Go
func solution(args interface{}) interface{} {
  return nil
}

# TypeScript
function solution(args: any): any {
  return null;
}

# C#
public class Solution {
  public static object Solution(object args) {
    return null;
  }
}
```

---

### executions

Registros de execução de código.

```sql
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  language VARCHAR(50) NOT NULL,
  code TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'error')),
  output TEXT,
  error TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_executions_session ON executions(session_id);
```

**Campos:**
- `id`: UUID único
- `session_id`: Sessão que executou
- `language`: Linguagem do código
- `code`: Código executado
- `status`: Estado (pending|running|completed|error)
- `output`: Saída padrão
- `error`: Saída de erro
- `execution_time_ms`: Tempo total em ms
- `created_at`, `updated_at`: Timestamps

---

### logs

Logs em tempo real de uma execução.

```sql
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id),
  message TEXT NOT NULL,
  level VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_execution ON logs(execution_id);
```

**Campos:**
- `execution_id`: Execução que gerou o log
- `message`: Mensagem do log
- `level`: info|error|warning
- `created_at`: Timestamp

---

### session_language_history

Histórico de mudanças de linguagem (legacy, mantido para compatibilidade).

```sql
CREATE TABLE session_language_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  content_type VARCHAR(50) NOT NULL DEFAULT 'code',
  language VARCHAR(50) NOT NULL,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_language_history_session ON session_language_history(session_id, created_at);
CREATE INDEX idx_language_history_challenge ON session_language_history(challenge_id, created_at);
```

---

## 🔑 Constraints e Integridade

### Primary Keys
- Todas as tabelas têm PK (UUID ou SERIAL)

### Foreign Keys
- `challenges.created_by` → `users.id` (ON DELETE CASCADE)
- `sessions.interviewer_id` → `users.id` (ON DELETE CASCADE)
- `sessions.interviewee_id` → `users.id` (ON DELETE SET NULL)
- `sessions.current_challenge_id` → `challenges.id` (ON DELETE CASCADE)
- `session_challenge_content.session_id` → `sessions.id` (ON DELETE CASCADE)
- `session_challenge_content.challenge_id` → `challenges.id`
- `executions.session_id` → `sessions.id` (ON DELETE CASCADE)
- `logs.execution_id` → `executions.id` (ON DELETE CASCADE)
- `starter_codes.challenge_id` → `challenges.id` (ON DELETE CASCADE)

### Unique Constraints
- `users.email` (UNIQUE)
- `session_challenge_content(session_id, challenge_id, content_type)` (UNIQUE)
- `starter_codes(challenge_id, language)` (UNIQUE)

### Check Constraints
- `users.role` IN ('interviewer', 'interviewee')
- `challenges.difficulty` IN ('basic', 'intermediate', 'advanced')
- `sessions.status` IN ('pending', 'active', 'completed', 'cancelled', 'expired')
- `executions.status` IN ('pending', 'running', 'completed', 'error')
- `session_challenge_content.content_type` IN ('code', 'notes')

---

## 📈 Índices para Performance

### Índices Principais
```sql
-- Lookup de usuários
idx_users_email

-- Lookup de desafios
idx_challenges_created_by

-- Lookup de sessões
idx_sessions_interviewer
idx_sessions_interviewee

-- Lookup de conteúdo (CRITICAL)
idx_session_challenge_content_session
idx_session_challenge_content_challenge
idx_session_challenge_content_lookup

-- Lookup de histórico
idx_content_history_session
idx_content_history_challenge
idx_content_history_lookup
idx_content_history_updated

-- Starter codes
idx_starter_codes_challenge
idx_starter_codes_lookup

-- Execuções
idx_executions_session

-- Logs
idx_logs_execution

-- Language history
idx_language_history_session
idx_language_history_challenge
```

---

## 🌱 Seeds Iniciais

### Sistema User
- Email: `system@sourcerank.com`
- Role: `interviewer`
- Usado para criar desafios pré-configurados

### 10 Desafios Pré-configurados
- 4 básicos (FizzBuzz, Two Sum, Reverse String, Palindrome)
- 3 intermediários (Valid Parentheses, Binary Search, Longest Substring)
- 3 avançados (Merge K Sorted, Median, Regex)

### Starter Codes
- 6 linguagens x 10 desafios = 60 templates
- Atualizado automaticamente ao criar novo desafio

---

## 🔄 Fluxo de Dados Típico

### 1. Criar Sessão
```
user (interviewer) 
  → sessions.create()
  → session_challenge_content.create(desafio1, python, starter_code)
  → session_code gerado
```

### 2. Candidato Edita Código
```
session_challenge_content.update()
  → marked as started=true
  → Socket emit 'session-code-changed'
  → 2s depois → persistContent() saves to DB
```

### 3. Trocar Linguagem
```
session_challenge_content.update(language=javascript)
  → session_challenge_content_history.insert() [old content]
  → session_challenge_content.update(content=new_starter)
  → sessions.update(preferred_language)
  → Socket emit 'session-language-changed'
```

### 4. Executar Código
```
executions.create(code, language)
  → Runner executa
  → logs.insert() para cada linha de output
  → Socket emit 'execution-log-{id}'
  → executions.update(status=completed)
```

### 5. Mudar Desafio
```
sessions.update(current_challenge_id=desafio2)
  → Socket emit 'session-challenge-changed'
  → Candidato vê novo desafio
  → session_challenge_content para desafio2 recuperado (ou criado novo)
```

---

## 💾 Backup e Recovery

### Exportar Schema
```bash
pg_dump -s sourcerank > schema.sql
```

### Exportar com Dados
```bash
pg_dump sourcerank > backup.sql
```

### Restaurar
```bash
psql sourcerank < backup.sql
```

---

## 📊 Queries Úteis

### Listar todas as sessões ativas
```sql
SELECT s.*, u1.name as interviewer, u2.name as interviewee, c.title as challenge
FROM sessions s
LEFT JOIN users u1 ON s.interviewer_id = u1.id
LEFT JOIN users u2 ON s.interviewee_id = u2.id
LEFT JOIN challenges c ON s.current_challenge_id = c.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC;
```

### Histórico de código de uma sessão
```sql
SELECT * FROM session_challenge_content_history
WHERE session_id = 'uuid-da-sessao'
ORDER BY updated_at DESC;
```

### Logs de uma execução
```sql
SELECT * FROM logs
WHERE execution_id = 'uuid-da-execucao'
ORDER BY created_at;
```

---

