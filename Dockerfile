FROM node:22.2.0

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