#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API="http://localhost:4000"
INTERVIEWER_EMAIL="interviewer-$(date +%s)@example.com"
INTERVIEWEE_EMAIL="interviewee-$(date +%s)@example.com"
PASSWORD="test123456"

echo -e "${BLUE}=== Testing CRDT Content Synchronization Flow ===${NC}\n"

# 1. Register interviewer
echo -e "${BLUE}1. Registering interviewer...${NC}"
REGISTER_INT=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$INTERVIEWER_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"interviewer\",
    \"name\": \"Test Interviewer\"
  }")

INTERVIEWER_ID=$(echo $REGISTER_INT | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Interviewer ID: $INTERVIEWER_ID"

# 2. Register interviewee
echo -e "${BLUE}2. Registering interviewee...${NC}"
REGISTER_EE=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$INTERVIEWEE_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"interviewee\",
    \"name\": \"Test Interviewee\"
  }")

INTERVIEWEE_ID=$(echo $REGISTER_EE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Interviewee ID: $INTERVIEWEE_ID"

# 3. Login as interviewer
echo -e "\n${BLUE}3. Logging in as interviewer...${NC}"
LOGIN_INT=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$INTERVIEWER_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

INTERVIEWER_TOKEN=$(echo $LOGIN_INT | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Interviewer Token: ${INTERVIEWER_TOKEN:0:50}..."

# 4. Get first challenge
echo -e "\n${BLUE}4. Getting first challenge...${NC}"
CHALLENGE=$(curl -s "$API/challenges?limit=1")
CHALLENGE_ID=$(echo $CHALLENGE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "Challenge ID: $CHALLENGE_ID"

# 5. Create session as interviewer
echo -e "\n${BLUE}5. Creating session for challenge $CHALLENGE_ID...${NC}"
SESSION=$(curl -s -X POST "$API/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INTERVIEWER_TOKEN" \
  -d "{
    \"intervieweeId\": \"$INTERVIEWEE_ID\",
    \"currentChallengeId\": $CHALLENGE_ID
  }")

SESSION_ID=$(echo $SESSION | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Session ID: $SESSION_ID"

if [ -z "$SESSION_ID" ]; then
  echo -e "${RED}Failed to create session${NC}"
  echo "Response: $SESSION"
  exit 1
fi

# 6. Set session to active
echo -e "\n${BLUE}6. Setting session to active...${NC}"
curl -s -X PATCH "$API/sessions/$SESSION_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INTERVIEWER_TOKEN" \
  -d '{"status": "active"}' > /dev/null

# 7. Login as interviewee
echo -e "\n${BLUE}7. Logging in as interviewee...${NC}"
LOGIN_EE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$INTERVIEWEE_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

INTERVIEWEE_TOKEN=$(echo $LOGIN_EE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Interviewee Token: ${INTERVIEWEE_TOKEN:0:50}..."

# 8. Get session (as interviewee)
echo -e "\n${BLUE}8. Getting session details...${NC}"
curl -s "$API/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $INTERVIEWEE_TOKEN" | grep -o '"current_challenge_id":[^,}]*'

echo -e "\n${GREEN}=== Test flow completed ===${NC}"

echo -e "\n${GREEN}=== Test completed ===${NC}"
