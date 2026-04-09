# Dockerfile for Admissions CRM Backend
FROM node:18-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/

EXPOSE 5000

CMD ["npm", "start"]
