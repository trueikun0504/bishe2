FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY admin/package*.json ./admin/

RUN npm install --omit=dev && npm install --prefix admin --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "start:admin"]
