FROM node:20-alpine

# Install OS-level dependencies required for Sharp or canvas if needed
RUN apk add --no-cache python3 make g++ vips-dev build-base

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the cache directory exists
RUN mkdir -p /app/cache/images

# Command is overridden in docker-compose.yml
CMD ["npm", "run", "start:api"]
