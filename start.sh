#!/bin/bash

echo "🚀 SourceRank - Platform de Entrevistas Técnicas"
echo "=============================================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado. Por favor, instale Docker.${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não encontrado. Por favor, instale Docker Compose.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker e Docker Compose encontrados${NC}"
echo ""

# Build e run
echo -e "${YELLOW}📦 Iniciando build...${NC}"
docker compose up --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Aplicação iniciada com sucesso!${NC}"
    echo ""
    echo -e "${GREEN}Acesse:${NC}"
    echo -e "  Frontend: ${YELLOW}http://localhost:5173${NC}"
    echo -e "  API:      ${YELLOW}http://localhost:4000${NC}"
    echo ""
    echo -e "${YELLOW}Credenciais de teste:${NC}"
    echo "  Email: teste@sourcerank.com"
    echo "  Senha: senha123"
else
    echo -e "${RED}❌ Erro ao iniciar a aplicação${NC}"
    exit 1
fi
