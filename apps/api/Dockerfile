FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN npm -w @twbbd/shared run build && npm -w @twbbd/api run build

EXPOSE 8787

CMD ["node", "--enable-source-maps", "apps/api/dist/serve.js"]

