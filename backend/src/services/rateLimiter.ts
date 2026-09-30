import redis from '../config/redis';

const getHourBucket = (time = Date.now()) => {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}`;
};

export const reserveSendDelay = async (
  senderId: string,
  delayMs: number
): Promise<{ allowed: boolean; waitMs: number }> => {
  const key = `send_delay:${senderId}`;
  const now = Date.now();

  const script = `
    local key = KEYS[1]
    local delayMs = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local last = tonumber(redis.call('GET', key) or '0')

    if last > 0 and (now - last) < delayMs then
      return cjson.encode({ allowed = false, waitMs = delayMs - (now - last) })
    end

    redis.call('SET', key, now, 'PX', math.max(1000, delayMs + 1000))
    return cjson.encode({ allowed = true, waitMs = 0 })
  `;

  const result = JSON.parse((await redis.eval(script, 1, key, String(delayMs), String(now))) as string);
  return {
    allowed: Boolean(result.allowed),
    waitMs: Number(result.waitMs || 0),
  };
};

export const clearSendDelay = async (senderId: string) => {
  await redis.del(`send_delay:${senderId}`);
};

export const reserveHourlySlot = async (
  senderId: string,
  hourlyLimit: number
): Promise<{ allowed: boolean; waitMs: number; currentCount: number }> => {
  const now = Date.now();
  const resetAt = new Date(Math.ceil(now / 3_600_000) * 3_600_000);
  const ttlMs = Math.max(1000, resetAt.getTime() - now + 1000);
  const key = `rate_limit:${senderId}:${getHourBucket(now)}`;

  const script = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local ttlMs = tonumber(ARGV[2])
    local current = tonumber(redis.call('GET', key) or '0')

    if current >= limit then
      return cjson.encode({ allowed = false, waitMs = ttlMs, current = current })
    end

    local nextCount = current + 1
    redis.call('SET', key, nextCount, 'PX', ttlMs)
    return cjson.encode({ allowed = true, waitMs = 0, current = nextCount })
  `;

  const result = JSON.parse((await redis.eval(script, 1, key, String(hourlyLimit), String(ttlMs))) as string);

  return {
    allowed: Boolean(result.allowed),
    waitMs: Number(result.waitMs || 0),
    currentCount: Number(result.current || 0),
  };
};

export const releaseHourlySlot = async (senderId: string) => {
  const key = `rate_limit:${senderId}:${getHourBucket(Date.now())}`;
  const script = `
    local key = KEYS[1]
    local current = tonumber(redis.call('GET', key) or '0')

    if current <= 0 then
      return 0
    end

    return redis.call('DECR', key)
  `;

  await redis.eval(script, 1, key);
};
