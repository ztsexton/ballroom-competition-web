FROM node:20-alpine

RUN npm install -g firebase-tools@latest

WORKDIR /firebase

COPY firebase.json .

EXPOSE 9099

CMD ["firebase", "emulators:start", "--only", "auth", "--project", "demo-test"]
