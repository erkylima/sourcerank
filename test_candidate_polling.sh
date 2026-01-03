#!/bin/bash

set -e

API_URL="http://localhost:4000/api"
INTERVIEWER_EMAIL="interviewer@test.com"
INTERVIEWER_PASSWORD="123456"
CANDIDATE_EMAIL="candidate@test.com"
CANDIDATE_PASSWORD="123456"

echo "🔵 TEST: Candidate Polling Flow"
echo "================================"

# Step 1: Create accounts
echo ""
echo "1️⃣ Creating interviewer account..."
curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$INTERVIEWER_EMAIL"'","password":"'"$INTERVIEWER_PASSWORD"'"}' | jq '.' > /tmp/interviewer.json
INTERVIEWER_ID=$(jq -r '.user.id' /tmp/interviewer.json)
INTERVIEWER_TOKEN=$(jq -r '.token' /tmp/interviewer.json)
echo "✓ Interviewer: $INTERVIEWER_ID"
echo "✓ Token: ${INTERVIEWER_TOKEN:0:20}..."

echo ""
echo "2️⃣ Creating candidate account..."
curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$CANDIDATE_EMAIL"'","password":"'"$CANDIDATE_PASSWORD"'"}' | jq '.' > /tmp/candidate.json
CANDIDATE_ID=$(jq -r '.user.id' /tmp/candidate.json)
CANDIDATE_TOKEN=$(jq -r '.token' /tmp/candidate.json)
echo "✓ Candidate: $CANDIDATE_ID"
echo "✓ Token: ${CANDIDATE_TOKEN:0:20}..."

# Step 2: Interviewer creates interview
echo ""
echo "3️⃣ Interviewer creating interview session..."
curl -s -X POST "$API_URL/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INTERVIEWER_TOKEN" \
  -d '{"title":"Test Interview"}' | jq '.' > /tmp/session.json
SESSION_ID=$(jq -r '.session.id' /tmp/session.json)
SESSION_CODE=$(jq -r '.session.session_code' /tmp/session.json)
echo "✓ Session ID: $SESSION_ID"
echo "✓ Session Code: $SESSION_CODE"

# Step 3: Candidate requests access
echo ""
echo "4️⃣ Candidate requesting access with code..."
curl -s -X POST "$API_URL/sessions/request-access" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -d '{"session_code":"'"$SESSION_CODE"'"}' | jq '.'

# Step 4: Candidate polls BEFORE accept
echo ""
echo "5️⃣ Candidate polling BEFORE interviewer accepts..."
POLL_1=$(curl -s -X GET "$API_URL/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" | jq '.session.interviewee_accepted')
echo "Poll result 1: $POLL_1 (should be false)"

# Step 5: Interviewer accepts
echo ""
echo "6️⃣ Interviewer accepting candidate..."
curl -s -X PATCH "$API_URL/sessions/$SESSION_ID/accept" \
  -H "Authorization: Bearer $INTERVIEWER_TOKEN" | jq '.message'

# Step 6: Candidate polls AFTER accept
echo ""
echo "7️⃣ Candidate polling AFTER interviewer accepts..."
POLL_2=$(curl -s -X GET "$API_URL/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" | jq '.session.interviewee_accepted')
echo "Poll result 2: $POLL_2 (should be true)"

# Results
echo ""
echo "================================"
echo "TEST RESULTS:"
echo "- Poll before accept: $POLL_1"
echo "- Poll after accept: $POLL_2"

if [ "$POLL_1" == "false" ] && [ "$POLL_2" == "true" ]; then
  echo "✅ BACKEND WORKS CORRECTLY!"
else
  echo "❌ BACKEND HAS AN ISSUE"
fi
