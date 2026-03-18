FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm ci
RUN npm ci --prefix backend
RUN npm ci --prefix frontend

COPY . .

RUN npm run build
RUN npm prune --omit=dev --prefix backend

FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/backend/package*.json backend/
COPY --from=build /app/backend/node_modules backend/node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

RUN mkdir -p /home/node/.config /home/node/.local/share

USER node

EXPOSE 3000

WORKDIR /app/backend

CMD ["node", "dist/index.js"]
