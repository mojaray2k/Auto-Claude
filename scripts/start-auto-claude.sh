#!/bin/bash

# Auto Claude Launcher - Start everything with one command
# Usage: auto-claude
# The app will launch in the background, terminal can be closed

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$SCRIPT_DIR" )"
LOG_FILE="$PROJECT_DIR/.auto-claude-startup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Auto Claude Launcher started"

# Step 1: Set up Python backend (if needed)
if [ ! -d "$PROJECT_DIR/auto-claude/.venv" ]; then
  log "${YELLOW}Setting up Python backend...${NC}"
  cd "$PROJECT_DIR/auto-claude" || { log "${RED}❌ Failed to change to auto-claude directory${NC}"; exit 1; }
  python3 -m venv .venv >> "$LOG_FILE" 2>&1
  source .venv/bin/activate
  pip install -q -r requirements.txt >> "$LOG_FILE" 2>&1
  cd "$PROJECT_DIR" || { log "${RED}❌ Failed to return to project directory${NC}"; exit 1; }
  log "${GREEN}✓ Python backend ready${NC}"
else
  log "${GREEN}✓ Python backend already set up${NC}"
fi

# Step 2: Install UI dependencies (if needed)
if [ ! -d "$PROJECT_DIR/auto-claude-ui/node_modules" ]; then
  log "${YELLOW}Installing UI dependencies (this may take a minute)...${NC}"
  cd "$PROJECT_DIR/auto-claude-ui" || { log "${RED}❌ Failed to change to auto-claude-ui directory${NC}"; exit 1; }
  npm install -q >> "$LOG_FILE" 2>&1
  log "${GREEN}✓ UI dependencies installed${NC}"
else
  log "${GREEN}✓ UI dependencies already installed${NC}"
fi

# Step 3: Build the UI
log "${YELLOW}Building UI...${NC}"
cd "$PROJECT_DIR/auto-claude-ui" || { log "${RED}❌ Failed to change to auto-claude-ui directory${NC}"; exit 1; }
npm run build >> "$LOG_FILE" 2>&1
log "${GREEN}✓ UI built successfully${NC}"

# Step 4: Launch the application in background
log "${YELLOW}Launching Auto Claude...${NC}"

# Start in background, detached from terminal
nohup npm start >> "$LOG_FILE" 2>&1 &

# Give it a moment to start
sleep 2

log "${GREEN}✓ Auto Claude is starting!${NC}"
log ""
log "📋 Application is launching in the background"
log "🖥️  Look for the Auto Claude window to appear"
log "📝 Logs saved to: $LOG_FILE"
log ""
log "✓ You can now close this terminal window"
