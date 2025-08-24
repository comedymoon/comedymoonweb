import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { rateLimitMiddleware, makeBlocklist } from './rateLimit.js';
import { tgSend } from './telegram.js';
import { maybePoW } from './pow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || './public');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*'}));
app.use(cookieParser());
app.set('trust proxy', true);
app.use(morgan('tiny'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

const blocklist = makeBlocklist();

// helper: ip getter
function getIP(req){
  return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
}

// --- Auto-ban for pattern "/?digits/anything" ---
app.use(async (req,res,next)=>{
  try{
    const url = req.originalUrl || '';
    // match: has "?" then <digits>/<something>
    if (/\?\d+\/.+/.test(url)) {
      const ip = getIP(req);
      await blocklist.add(ip, 24*3600); // 24h
      await tgSend(`🤖 autoban: ${ip} — matched suspicious pattern "${url}"`);
      return res.status(403).send('Forbidden');
    }
  }catch(e){ /* ignore */ }
  next();
});

// blocklist gate
app.use(async (req,res,next)=>{
  const ip = getIP(req);
  if (await blocklist.has(ip)) return res.status(403).send('Forbidden');
  next();
});

// optional PoW
app.use(maybePoW);

// rate limit
app.use(rateLimitMiddleware());

// health
app.get('/healthz', (req,res)=>res.json({ok:true, ts: Date.now()}));

// --- Admin auth ---
function adminToken(){ return crypto.createHash('sha256').update(String(ADMIN_SECRET)).digest('hex'); }
function requireAdmin(req,res,next){
  const c = req.cookies.adm;
  if (c && c === adminToken()) return next();
  return res.redirect('/admin/login');
}

app.get('/admin/login', (req,res)=>{
  res.sendFile(path.join(__dirname,'admin','login.html'));
});
app.post('/admin/login', (req,res)=>{
  const pass = req.body.password || '';
  if (pass && pass === ADMIN_SECRET) {
    res.cookie('adm', adminToken(), { httpOnly:true, sameSite:'Lax', maxAge:7*24*3600*1000 });
    return res.redirect('/admin');
  }
  res.status(401).send('Unauthorized');
});
app.get('/admin', requireAdmin, (req,res)=> res.sendFile(path.join(__dirname,'admin','index.html')));

// Admin API
app.get('/admin/api/list', requireAdmin, async (req,res)=>{
  res.json(await blocklist.list());
});
app.post('/admin/api/block', requireAdmin, async (req,res)=>{
  let { ip, ttl } = req.body || {};
  ttl = Math.max(60, Math.min(86400*7, parseInt(ttl||'3600',10)));
  await blocklist.add(String(ip||'').trim(), ttl);
  res.json({ok:true});
});
app.post('/admin/api/unblock', requireAdmin, async (req,res)=>{
  let { ip } = req.body || {};
  await blocklist.remove(String(ip||'').trim());
  res.json({ok:true});
});

// manual/block via secret (for scripts/curl)
app.post('/admin/block', async (req,res)=>{
  const { secret, ip, ttl } = req.body || {};
  if (secret !== ADMIN_SECRET) return res.status(401).json({ok:false});
  await blocklist.add(ip, Math.max(60, Math.min(86400, parseInt(ttl||'3600',10))));
  res.json({ok:true});
});

// Telegram sampling logger
app.use(async (req,res,next)=>{
  if (Math.random() < 0.02) {
    const ip = getIP(req);
    tgSend(`🌐 ${req.method} ${req.originalUrl}\nIP: ${ip}\nUA: ${req.headers['user-agent']||'-'}`);
  }
  next();
});

// static site
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((req,res)=> res.status(404).send('Not found'));

app.listen(PORT, ()=>{
  console.log('Guard listening on', PORT, 'serving', PUBLIC_DIR);
  tgSend('🛡 comedymoon-guard (advanced) is up on port '+PORT);
});
