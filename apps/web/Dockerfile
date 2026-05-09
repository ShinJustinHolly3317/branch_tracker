FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN npm -w @twbbd/shared run build && npm -w @twbbd/web run build

EXPOSE 5173

CMD ["npm", "-w", "@twbbd/web", "run", "dev"]

