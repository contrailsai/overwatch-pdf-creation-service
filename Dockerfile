FROM node:20-alpine

# Install OS-level dependencies required for node-gyp (removed vips-dev so sharp downloads its pre-compiled musl binaries with all codecs)
RUN apk add --no-cache python3 make g++ build-base

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the cache directory exists
RUN mkdir -p /app/cache/images

# Command is overridden in docker-compose.yml
CMD ["npm", "run", "start:api"]
