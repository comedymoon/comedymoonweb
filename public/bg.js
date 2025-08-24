
const c = document.getElementById('bg');
if (c) {
  const ctx = c.getContext('2d');
  let W,H,orbs=[];
  function resize(){ W=c.width=innerWidth*devicePixelRatio; H=c.height=innerHeight*devicePixelRatio; }
  resize(); addEventListener('resize', resize);
  const r=(a,b)=>Math.random()*(b-a)+a;
  const make=()=>({x:r(0,W),y:r(0,H),r:r(120*devicePixelRatio,280*devicePixelRatio),dx:r(-.2,.2),dy:r(-.2,.2),h:Math.random()<.5?275:195});
  for(let i=0;i<8;i++) orbs.push(make());
  (function loop(){
    ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter';
    for(const o of orbs){
      const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r);
      g.addColorStop(0,`hsla(${o.h},100%,60%,.06)`); g.addColorStop(1,`hsla(${o.h},100%,60%,0)`);
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fill();
      o.x+=o.dx; o.y+=o.dy; if(o.x<-o.r||o.x>W+o.r) o.dx*=-1; if(o.y<-o.r||o.y>H+o.r) o.dy*=-1;
    } requestAnimationFrame(loop);
  })();
}
