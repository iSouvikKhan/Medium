# Build from the repository root: docker build -f frontend/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY common/package.json common/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w frontend -w common --ignore-scripts
COPY common common
COPY frontend frontend
RUN npm run build -w frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
