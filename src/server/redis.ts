import { createClient } from "redis";
import { env } from "./config.js";
export const redisChannel = `aplime:${env.APP_ENV}:live`;
export const redisKey = (key: string) => `aplime:${env.APP_ENV}:${key}`;
export const redis = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      commandOptions: { timeout: 1500 },
      pingInterval: 5000,
      socket: { connectTimeout: 3000, socketTimeout: 10000 },
    })
  : null;
redis?.on("error", () => console.error("Redis connection unavailable"));
export async function startRedis() {
  if (redis && !redis.isOpen) await redis.connect();
}
// Only cache recomputable, non-sensitive data. Authorization always reads PostgreSQL.
export async function cachedValue<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis?.get(redisKey(`cache:${key}`));
    if (hit) return JSON.parse(hit);
  } catch {}
  const value = await load();
  try {
    await redis?.set(redisKey(`cache:${key}`), JSON.stringify(value), {
      EX: ttl,
    });
  } catch {}
  return value;
}
