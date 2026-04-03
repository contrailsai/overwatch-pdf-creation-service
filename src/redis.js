const { Redis } = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

module.exports = {
  redisConnection,
};
