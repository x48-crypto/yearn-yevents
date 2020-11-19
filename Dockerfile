FROM node:12-buster

EXPOSE 8080

COPY . .

ENTRYPOINT node /server.js