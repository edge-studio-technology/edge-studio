FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.25-alpine AS runtime
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker-entrypoint.d/15-edge-studio-upload-limit.envsh /docker-entrypoint.d/
COPY nginx-snippets/backend-proxy.conf /etc/nginx/snippets/backend-proxy.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -kfs https://127.0.0.1/ -o /dev/null || exit 1
