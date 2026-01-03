#!/bin/bash

# Quick Start Guide - SourceRank Interview Platform
# Este script configura e inicia o projeto completo

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║  SourceRank - Technical Interview Platform        ║"
echo "║  Quick Start Setup                                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"

# Option 1: Docker Compose
if command -v docker-compose >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker Compose found"
    echo ""
    echo "Choose start method:"
    echo "1) Docker Compose (recommended for quick start)"
    echo "2) Local development (requires PostgreSQL)"
    read -p "Select (1-2): " choice
    
    if [ "$choice" = "1" ]; then
        echo ""
        echo -e "${BLUE}Starting with Docker Compose...${NC}"
        docker-compose up --build
        exit 0
    fi
fi

# Option 2: Local setup
echo ""
echo -e "${BLUE}Local Development Setup${NC}"
echo ""

# Backend
echo -e "${YELLOW}Setting up Backend (Node.js + TypeScript)...${NC}"
cd api

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

echo -e "${GREEN}✓${NC} Backend ready at port 4000"
echo ""

# Frontend
echo -e "${YELLOW}Setting up Frontend (React + Vite)...${NC}"
cd ../web

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

echo -e "${GREEN}✓${NC} Frontend ready at port 5173"
echo ""

# Runner
echo -e "${YELLOW}Setting up Runner (Code Execution)...${NC}"
cd ../runner

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

echo -e "${GREEN}✓${NC} Runner ready at port 3001"
echo ""

# Instructions
echo "╔════════════════════════════════════════════════════╗"
echo "║  Setup Complete! Start services in new terminals:  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Terminal 1 - Backend:${NC}"
echo "  cd api"
echo "  npm run dev"
echo ""
echo -e "${BLUE}Terminal 2 - Frontend:${NC}"
echo "  cd web"
echo "  npm run dev"
echo ""
echo -e "${BLUE}Terminal 3 - Runner:${NC}"
echo "  cd runner"
echo "  npm start"
echo ""
echo -e "${BLUE}Accessing the platform:${NC}"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:4000"
echo "  Health:    http://localhost:4000/health"
echo ""
echo -e "${YELLOW}Default Credentials (create during registration):${NC}"
echo "  Interviewer role: Create a new account"
echo "  Interviewee role: Create a new account"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "  1. Create an Interviewer account"
echo "  2. Create coding challenges"
echo "  3. Create an Interviewee account"
echo "  4. Start an interview session"
echo "  5. Submit code and see real-time execution"
echo ""
echo -e "${BLUE}For more information:${NC}"
echo "  - README.md - Project overview"
echo "  - API_REFACTOR.md - Architecture details"
echo "  - API_TESTING.md - API examples"
echo "  - DEVELOPMENT_GUIDE.md - Development setup"
echo ""
