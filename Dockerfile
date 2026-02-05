# Multi-stage Dockerfile for Ballroom Competition Web
# Serves both frontend and backend from a single container

# ============================================
# Stage 1: Install dependencies and build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies (both workspaces)
RUN npm ci

# Copy source files
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend
RUN npm run build --workspace=frontend

# Build backend
RUN npm run build --workspace=backend

# ============================================
# Stage 2: Production runtime
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy root workspace files for production install
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install only backend production dependencies
RUN npm ci --workspace=backend --omit=dev && npm cache clean --force

# Copy built backend from builder
COPY --from=builder /app/backend/dist ./dist

# Copy built frontend to be served as static files
COPY --from=builder /app/frontend/dist ./public

# Create data directory for JSON storage (if using json data store)
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV USE_HTTPS=false
# In Kubernetes, TLS is typically terminated at the ingress/load balancer

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
