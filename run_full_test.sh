#!/bin/bash

API="http://localhost:4000"
INT_EMAIL="interviewer_final@test.com"
INT_PASS="123456"
CAND_EMAIL="candidate_final@test.com"
CAND_PASS="123456"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔬 TESTE COMPLETO - FLUXO DE POLLING DO CANDIDATO             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Registrar entrevistador
echo "1️⃣ REGISTRANDO ENTREVISTADOR..."
INT_RES=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$INT_EMAIL"'","password":"'"$INT_PASS"'","role":"interviewer","name":"Int"}')
INT_ID=$(echo "$INT_RES" | jq -r '.user.id')
INT_TOKEN=$(echo "$INT_RES" | jq -r '.token')
echo "✓ Entrevistador: $INT_ID"
echo ""

# 2. Registrar candidato
echo "2️⃣ REGISTRANDO CANDIDATO..."
CAND_RES=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$CAND_EMAIL"'","password":"'"$CAND_PASS"'","role":"interviewee","name":"Cand"}')
CAND_ID=$(echo "$CAND_RES" | jq -r '.user.id')
CAND_TOKEN=$(echo "$CAND_RES" | jq -r '.token')
echo "✓ Candidato: $CAND_ID"
echo ""

# 3. Entrevistador cria sessão
echo "3️⃣ ENTREVISTADOR CRIANDO SESSÃO..."
SESSION_RES=$(curl -s -X POST "$API/sessions/create-interview" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INT_TOKEN" \
  -d '{}')
SESSION_ID=$(echo "$SESSION_RES" | jq -r '.session.id')
SESSION_CODE=$(echo "$SESSION_RES" | jq -r '.session.session_code')
echo "✓ Sessão: $SESSION_ID"
echo "✓ Código: $SESSION_CODE"
echo ""

# 4. Candidato solicita acesso
echo "4️⃣ CANDIDATO SOLICITANDO ACESSO..."
REQ_RES=$(curl -s -X POST "$API/sessions/request-access" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAND_TOKEN" \
  -d '{"sessionCode":"'"$SESSION_CODE"'"}')
echo "✓ Solicitação enviada"
echo ""

# 5. Candidato poll ANTES da aceitação
echo "5️⃣ CANDIDATO POLLING (ANTES DE ACEITAR)..."
POLL_BEFORE=$(curl -s -X GET "$API/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CAND_TOKEN" | jq '.session.interviewee_accepted')
echo "✓ Poll antes: $POLL_BEFORE (esperado: false)"
echo ""

# 6. Entrevistador aceita
echo "6️⃣ ENTREVISTADOR ACEITANDO CANDIDATO..."
ACCEPT_RES=$(curl -s -X PATCH "$API/sessions/$SESSION_ID/accept" \
  -H "Authorization: Bearer $INT_TOKEN")
echo "✓ Candidato aceito"
echo ""

# 7. Candidato poll APÓS aceitação
echo "7️⃣ CANDIDATO POLLING (DEPOIS DE ACEITAR)..."
POLL_AFTER=$(curl -s -X GET "$API/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CAND_TOKEN" | jq '.session.interviewee_accepted')
echo "✓ Poll depois: $POLL_AFTER (esperado: true)"
echo ""

# 8. Resultados
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  RESULTADOS                                                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Poll antes de aceitar:  $POLL_BEFORE  (esperado: false)"
echo "Poll depois de aceitar: $POLL_AFTER   (esperado: true)"
echo ""

if [ "$POLL_BEFORE" == "false" ] && [ "$POLL_AFTER" == "true" ]; then
  echo "✅ ✅ ✅  TESTE PASSOU! O FLUXO DE POLLING FUNCIONA! ✅ ✅ ✅"
  echo ""
  echo "O frontend agora deveria:"
  echo "  1. Fazer polling a cada 2 segundos"
  echo "  2. Detectar quando interviewee_accepted = true"
  echo "  3. Redirecionar para /interview-session/$SESSION_ID"
  exit 0
else
  echo "❌ ❌ ❌  TESTE FALHOU! ❌ ❌ ❌"
  echo ""
  echo "Algo está errado:"
  echo "  - Poll antes deveria ser false, foi: $POLL_BEFORE"
  echo "  - Poll depois deveria ser true, foi: $POLL_AFTER"
  exit 1
fi
