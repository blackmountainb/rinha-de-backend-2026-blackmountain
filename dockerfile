FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 9999

CMD ["node", "dist/index.js"]