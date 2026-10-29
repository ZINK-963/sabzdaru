# Build with the repository root as context: docker build -f backend/Dockerfile .
FROM node:20-bookworm-slim AS dependencies
WORKDIR /app/backend
COPY backend/package.json ./package.json
RUN npm install --no-audit --no-fund

FROM node:20-bookworm-slim AS builder
WORKDIR /app/backend
COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY frontend/ /app/frontend/
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/backend
COPY --from=builder /app/backend/ ./
COPY --from=builder /app/frontend/ /app/frontend/
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
