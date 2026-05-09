FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/ingester/package.json ./apps/ingester/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install

COPY apps/ingester ./apps/ingester
COPY packages/shared ./packages/shared

RUN npm -w @twbbd/shared run build && npm -w @twbbd/ingester run build

CMD ["node", "--enable-source-maps", "apps/ingester/dist/index.js", "ingest:once"]

