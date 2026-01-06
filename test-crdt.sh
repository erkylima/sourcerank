#!/bin/bash

# SourceRank - Test CRDT Integration
# This script starts the stack and enables CRDT for testing

set -e

echo "🚀 SourceRank CRDT Test Suite"
echo "=============================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker not found${NC}"
  exit 1
fi

echo -e "${YELLOW}1. Building images...${NC}"
docker compose build --no-cache yjs-relay web api runner

echo -e "${YELLOW}2. Starting services with CRDT enabled...${NC}"
ENABLE_S3_SNAPSHOT=false docker compose up -d

echo -e "${YELLOW}3. Waiting for services to be ready...${NC}"
sleep 5

echo -e "${YELLOW}4. Checking health...${NC}"

# Check API
if docker exec sr_api curl -s http://localhost:4000/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ API is healthy${NC}"
else
  echo -e "${RED}✗ API is not responding${NC}"
  docker logs sr_api --tail 20
  exit 1
fi

# Check Yjs relay
if docker exec sr_yjs_relay nc -zv localhost 1234 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Yjs relay is listening${NC}"
else
  echo -e "${RED}✗ Yjs relay is not responding${NC}"
  docker logs sr_yjs_relay --tail 20
  exit 1
fi

# Check Frontend
if docker exec sr_web curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Frontend is ready${NC}"
else
  echo -e "${YELLOW}⚠ Frontend still booting...${NC}"
fi

echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo "📍 Access points:"
echo "  • Frontend: http://localhost:5173"
echo "  • API: http://localhost:4000"
echo "  • Yjs relay: ws://localhost:1234/yjs"
echo ""
echo "📝 Test credentials:"
echo "  • Interviewer: interviewer@test.com / password123"
echo "  • Candidate: candidate@test.com / password123"
echo ""
echo "🔧 To test CRDT:"
echo "  1. Create a session as interviewer"
echo "  2. Join as candidate"
echo "  3. Edit code in both browser windows"
echo "  4. Watch real-time sync with conflict-free merges!"
echo ""
echo "📊 Monitor logs:"
echo "  docker compose logs -f yjs-relay"
echo "  docker compose logs -f web"
echo "  docker compose logs -f api"
echo ""
echo "🛑 To stop: docker compose down"
