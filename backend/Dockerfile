FROM node:20-alpine

WORKDIR /app

# Copy root package for workspace resolution
COPY package.json ./
COPY backend/package.json ./backend/

# Install backend deps
WORKDIR /app/backend
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/app.js"]
