FROM node:12

WORKDIR /usr/src/calling-stats

COPY package.json .
RUN npm install

EXPOSE 8010
EXPOSE 8020

COPY . .

CMD [ "npm", "start" ]
