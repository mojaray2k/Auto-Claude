# Auto Claude UI - Desktop App in Docker
# This Dockerfile builds the Auto Claude UI for containerized deployment

FROM node:20-alpine

# Install additional dependencies (runtime only, no dev packages)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    dbus \
    libxkbcommon

WORKDIR /app

# Copy package files
COPY auto-claude-ui/package.json auto-claude-ui/pnpm-lock.yaml ./

# Install dependencies (pin pnpm version for reproducible builds)
RUN npm install -g pnpm@9.15.0 && \
    pnpm install --frozen-lockfile

# Copy application code
COPY auto-claude-ui/ ./

# Copy Python backend
COPY auto-claude/ ../auto-claude/

# Build the application
RUN npm run build

# Start the application
CMD ["npm", "start"]

EXPOSE 3000
