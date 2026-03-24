#!/bin/bash
# validate-and-commit.sh — Automated build pipeline with validation gates
# Usage: ./scripts/validate-and-commit.sh "feat(scope): commit message"
# Each gate must pass before proceeding. Fails fast on first error.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo -e "${RED}ERROR: Commit message required${NC}"
  echo "Usage: ./scripts/validate-and-commit.sh \"feat(scope): description\""
  exit 1
fi

# Validate commit message format
if ! echo "$MSG" | grep -qE '^(feat|fix|refactor|test|docs|chore)\(.+\): .+'; then
  echo -e "${RED}ERROR: Commit message must match format: type(scope): description${NC}"
  echo "Types: feat, fix, refactor, test, docs, chore"
  exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  RAMICHE BUILD PIPELINE${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

# Gate 1: Lint
echo -e "\n${CYAN}[1/4] ESLint...${NC}"
npm run lint
echo -e "${GREEN}✓ Lint passed${NC}"

# Gate 2: TypeScript
echo -e "\n${CYAN}[2/4] TypeScript...${NC}"
npm run typecheck
echo -e "${GREEN}✓ TypeScript passed${NC}"

# Gate 3: Tests
echo -e "\n${CYAN}[3/4] Vitest...${NC}"
npm run test
echo -e "${GREEN}✓ Tests passed${NC}"

# Gate 4: Build
echo -e "\n${CYAN}[4/4] Next.js build...${NC}"
npm run build
echo -e "${GREEN}✓ Build passed${NC}"

# All gates passed — commit
echo -e "\n${CYAN}All gates passed. Committing...${NC}"
git add -A
git commit -m "$MSG"
echo -e "${GREEN}✓ Committed: $MSG${NC}"

# Push
echo -e "\n${CYAN}Pushing to origin/main...${NC}"
git push origin main
echo -e "${GREEN}✓ Pushed${NC}"

echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  PIPELINE COMPLETE${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
