FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js ./

RUN npm ci

COPY src ./src
COPY index.html ./

RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
