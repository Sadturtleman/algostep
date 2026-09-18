FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/runner/package.json apps/runner/package.json
RUN npm ci
COPY tsconfig.json ./
COPY apps/server apps/server
RUN npm run build -w apps/server && npx playwright install --with-deps chromium
ENV HOST=0.0.0.0 PORT=3001 NODE_ENV=production
EXPOSE 3001
WORKDIR /app/apps/server
CMD ["node","dist/index.js"]
