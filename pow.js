import crypto from 'crypto';
const DIFF = parseInt(process.env.POW_DIFFICULTY || '0', 10);
export function maybePoW(req,res,next){
  if (DIFF <= 0) return next();
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/assets') || req.path.match(/\.(css|js|png|jpg|svg|ico|txt|json)$/)) return next();
  if (req.cookies.pow_ok === '1') return next();
  const salt = crypto.randomBytes(8).toString('hex');
  return res.status(403).send(`<!doctype html><meta charset="utf-8"><title>Checking...</title>
    <style>html,body{height:100%;display:grid;place-items:center;background:#0b0c15;color:#cfe3ff;font-family:system-ui}</style>
    <h1>checking your browser...</h1>
    <script>
    (async () => {
      const diff=${DIFF}; const enc=t=>new TextEncoder().encode(t);
      const salt='${salt}'; let nonce=0;
      function hex(b){return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
      while(true){
        const data = await crypto.subtle.digest('SHA-256', enc(nonce+'|'+salt));
        const h = hex(data);
        if(h.startsWith('0'.repeat(diff))){ break; }
        nonce++; if(nonce % 5000 === 0) await new Promise(r=>setTimeout(r,0));
      }
      document.cookie = "pow_ok=1; Max-Age=1800; path=/; SameSite=Lax";
      location.reload();
    })();
    </script>`);
}
