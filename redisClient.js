// utils/redisClient.js
import redis from "redis";

const client = redis.createClient({
  url: 'redis://default:myStrongRedisPass123@localhost:6379'
});

client.on('error', (err) => console.error('Redis Client Error:', err));

client.connect();

export default client;
