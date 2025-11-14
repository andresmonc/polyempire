# Unified Dockerfile - builds both frontend and backend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY src ./src
COPY public ./public
COPY shared ./shared
COPY index.html ./

# Build frontend
RUN npm run build

# Backend builder stage
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY server/package*.json ./
COPY server/tsconfig.json ./

# Install backend dependencies
RUN npm ci

# Copy backend source
COPY server/src ./src
COPY shared ../shared

# Build backend TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built backend from builder
# Backend builds to server/dist/, we'll put it at /app/server-dist
# So server/dist/index.js -> /app/server-dist/index.js
# And server/dist/app.js -> /app/server-dist/app.js
COPY --from=backend-builder /app/dist ./server-dist

# Copy built frontend to dist (root level)
# Frontend builds to dist/, we'll put it at /app/dist
# From server-dist/app.js, ../dist resolves to /app/dist ✓
COPY --from=frontend-builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server from server-dist
CMD ["node", "server-dist/index.js"]

