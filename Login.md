# Login as Interviewer
INTERVIEWER=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "interviewer@test.com",
    "password": "password123"
  }')
INTERVIEWER_TOKEN=$(echo "$INTERVIEWER" | jq -r '.token')
INTERVIEWER_ID=$(echo "$INTERVIEWER" | jq -r '.user.id')

# Login as Candidate
CANDIDATE=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@test.com",
    "password": "candtest123"
  }')
CANDIDATE_TOKEN=$(echo "$CANDIDATE" | jq -r '.token')
CANDIDATE_ID=$(echo "$CANDIDATE" | jq -r '.user.id')
