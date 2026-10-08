# Optional: runs the Worker locally with `wrangler dev` (workerd) inside a container.
# Build from the repository root: docker build -f backend/Dockerfile .
FROM node:22-bookworm-slim
ENV WRANGLER_SEND_METRICS=false
WORKDIR /app

COPY package.json package-lock.json ./
COPY common/package.json common/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend -w common --ignore-scripts

COPY common common
COPY backend backend
RUN npm run db:generate -w backend

WORKDIR /app/backend
EXPOSE 8787
# Write .dev.vars from the container environment, apply migrations, then serve the Worker.
CMD ["sh", "-c", "printf 'DATABASE_URL=\"%s\"\\nJWT_SECRET=\"%s\"\\n' \"$DATABASE_URL\" \"$JWT_SECRET\" > .dev.vars && npx prisma migrate deploy && npx wrangler dev --ip 0.0.0.0 --port 8787 --var CORS_ORIGINS:$CORS_ORIGINS"]
