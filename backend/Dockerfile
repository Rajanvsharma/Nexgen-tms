FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node src/app.js"]
