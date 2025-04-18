FROM node:23.11.0-slim

# Install OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

RUN npm install nodemon

COPY . .

RUN rm -rf node_modules/long

RUN npm run build

RUN npx prisma generate 

EXPOSE 5001

RUN chown -R node /usr/src/app

USER node

CMD ["npm","run","dev"]