FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dist ./dist
COPY db ./db

EXPOSE 3000

CMD ["node", "dist/core/server.js"]
