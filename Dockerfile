FROM node:20-alpine

RUN apk add --no-cache ffmpeg yt-dlp

WORKDIR /opt/mix-id
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY cli.mjs ./
COPY lib ./lib

WORKDIR /work
ENTRYPOINT ["node", "/opt/mix-id/cli.mjs"]
