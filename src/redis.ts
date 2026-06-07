import { createClient } from "redis";

export const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

client.on("error", (err) => console.log(`Redis client Error`, err));
