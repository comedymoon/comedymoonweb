import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { tgSend } from './telegram.js';

const redisURL = process.env.REDIS_URL;
const pointsPerIP = parseInt(process.env.RATE_POINTS || '120', 10);
const windowSec  = parseInt(process.env.RATE_WINDOW || '60', 10);
const alertEvery = parseInt(process.env.RATE_ALERT_EVERY || '200', 10);

let limiter, redisClient;
if (redisURL) {
  redisClient = new Redis(redisURL, { maxRetriesPerRequest: 2, enableReadyCheck: false });
  limiter = new RateLimiterRedis({ storeClient: redisClient, points: pointsPerIP, duration: windowSec, keyPrefix: 'rlip' });
} else {
  limiter = new RateLimiterMemory({ points: pointsPerIP, duration: windowSec });
}

const burst429 = new Map();

export function rateLimitMiddleware(){
  return async (req,res,next)=>{
    const ip = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    try{
      await limiter.consume(ip||'anon',1);
      next();
    }catch(rej){
      res.set('Retry-After', String(Math.ceil((rej.msBeforeNext||1000)/1000)));
      res.status(429).send('Too Many Requests');
      const c = (burst429.get(ip)||0)+1; burst429.set(ip,c);
      if(c % alertEvery === 0) tgSend(`⚠️ DDoS spike from ${ip} — ${c} blocked in last window`);
    }
  };
}

// Blocklist with list/unblock
export function makeBlocklist(){
  const mem = new Map(); // ip -> expireTs
  const hasRedis = !!redisClient;
  const setKey = 'bl:set';

  async function add(ip, ttlSec=3600){
    const until = Date.now()+ttlSec*1000;
    if(hasRedis){
      await redisClient.hset('bl:ttl', ip, String(until));
      await redisClient.sadd(setKey, ip);
    } else {
      mem.set(ip, until);
    }
    tgSend(`⛔️ Auto-blocked ${ip} for ${ttlSec}s`);
  }

  async function has(ip){
    if(hasRedis){
      const until = Number(await redisClient.hget('bl:ttl', ip) || 0);
      if(!until) return false;
      if(Date.now()>until){ await redisClient.hdel('bl:ttl', ip); await redisClient.srem(setKey, ip); return false; }
      return true;
    } else {
      const until = mem.get(ip); if(!until) return false;
      if(Date.now()>until){ mem.delete(ip); return false; }
      return true;
    }
  }

  async function list(){
    if(hasRedis){
      const ips = await redisClient.smembers(setKey);
      const out = [];
      for(const ip of ips){
        const until = Number(await redisClient.hget('bl:ttl', ip) || 0);
        if(until && until>Date.now()) out.push({ip, until});
      }
      return out.sort((a,b)=>a.until-b.until);
    } else {
      return [...mem.entries()].filter(([_,t])=>t>Date.now()).map(([ip,until])=>({ip,until})).sort((a,b)=>a.until-b.until);
    }
  }

  async function remove(ip){
    if(hasRedis){
      await redisClient.hdel('bl:ttl', ip);
      await redisClient.srem(setKey, ip);
    } else {
      mem.delete(ip);
    }
  }

  return { add, has, list, remove };
}
