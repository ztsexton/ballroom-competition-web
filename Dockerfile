# Multi-stage Dockerfile for Ballroom Competition Web
# Serves both frontend and backend from a single container

# ============================================
# Stage 1: Build the frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend (outputs to dist/)
RUN npm run build

# ============================================
# Stage 2: Build the backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy backend source
COPY backend/ ./

# Build TypeScript (outputs to dist/)
RUN npm run build

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy backend package files and install production dependencies only
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy built frontend to be served as static files
COPY --from=frontend-builder /app/frontend/dist ./public

# Create data directory for JSON storage (if using json data store)
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Copy data directory structure (optional - can mount as volume instead)
# COPY data/ ./data/

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
