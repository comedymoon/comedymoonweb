import fetch from 'node-fetch';
const BOT = process.env.TG_BOT_TOKEN;
const CHAT = process.env.TG_CHAT_ID;
export async function tgSend(text){
  if(!BOT || !CHAT) return;
  try{
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: CHAT, text: String(text).slice(0,3900), disable_web_page_preview:true })
    });
  }catch(e){ console.error('tgSend failed', e.message); }
}
