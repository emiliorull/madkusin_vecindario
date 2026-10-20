# Etapa 1: Build de la aplicación React + Vite + Tailwind
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_N8N_WEBHOOK_DISPONIBILIDAD=https://n8n.madkusin.com/webhook/vecindario-disponibilidad
ARG VITE_N8N_WEBHOOK_RESERVAR=https://n8n.madkusin.com/webhook/vecindario-reservar
ARG VITE_TELEGRAM_BOT_USERNAME=madkusin_citas_bot
ARG VITE_VOICE_PROVIDER=gemini

ENV VITE_N8N_WEBHOOK_DISPONIBILIDAD=$VITE_N8N_WEBHOOK_DISPONIBILIDAD
ENV VITE_N8N_WEBHOOK_RESERVAR=$VITE_N8N_WEBHOOK_RESERVAR
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME
ENV VITE_VOICE_PROVIDER=$VITE_VOICE_PROVIDER

COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Servidor ligero de producción
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

EXPOSE 3000
CMD ["node", "server.js"]
