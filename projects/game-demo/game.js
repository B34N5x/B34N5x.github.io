
const mats=["Plasma","Ice","Obsidian","Neon","Bone"],types=[["Weapon","Blaster"],["Armour","Shield"],["Companion","Puppy"]],rar=["Common","Rare","Legendary"];
function rnd(a){return a[Math.floor(Math.random()*a.length)]}
const nfts=[];for(let i=0;i<4;i++){const t=types[i%3],m=rnd(mats);nfts.push({name:m+" "+t[1],col:"Sample Collection #"+(100+i),kind:t[0],mat:m,rarity:Math.floor(Math.random()*3)})}
function stats(n){const s={shots:1,speed:4,shield:0,pup:false,dmg:1};const p=1+n.rarity;
 s.color={Plasma:"#f4f",Ice:"#8ff",Obsidian:"#888",Neon:"#ff0",Bone:"#fed"}[n.mat]||"#2f8";
 if(n.kind=="Weapon"){s.shots=p;if(n.mat=="Plasma")s.dmg=2}
 if(n.kind=="Armour"){s.shield=p;if(n.mat=="Ice")s.speed=3}
 if(n.kind=="Companion")s.pup=true;s.mat=n.mat;return s}
function explain(n,s){return n.name+" ["+rar[n.rarity]+"] from "+n.col+": "+(n.kind=="Weapon"?s.shots+" shot(s), damage "+s.dmg:n.kind=="Armour"?"blocks "+s.shield+" hit(s)":"the puppy barks when enemies get close and bites any that touch you")}
let eq=null,S=stats({kind:"",mat:"Neon",rarity:0});const cd=document.getElementById("cards"),L=document.getElementById("log");
function log(t){L.textContent=t}
nfts.forEach(n=>{const d=document.createElement("div");d.className="card";d.innerHTML="<b>"+n.name+"</b><br>"+n.col+"<br>Type: "+n.kind+"<br>Material: "+n.mat+"<br>Rarity: "+rar[n.rarity];
 d.onclick=()=>{document.querySelectorAll(".card").forEach(x=>x.classList.remove("on"));d.classList.add("on");eq=n;S=stats(n);log(explain(n,S));reset()};cd.appendChild(d)});
const c=document.getElementById("c"),g=c.getContext("2d");let FX=[];let P,B,E,sh,score,over,keys={},t=0,bark=0,tx=null,D={x:0,y:0,cd:0};
function reset(){P={x:160,y:390};D={x:185,y:395,cd:0};B=[];E=[];sh=S.shield;score=0;over=false;for(let r=0;r<3;r++)for(let k=0;k<6;k++)E.push({x:30+k*50,y:40+r*35,hp:1+r%2})}
reset();onkeydown=e=>keys[e.key]=1;onkeyup=e=>keys[e.key]=0;
c.addEventListener("pointerdown",e=>{tx=e;if(over)reset()});c.addEventListener("pointermove",e=>{if(tx)tx=e});c.addEventListener("pointerup",()=>tx=null);
function loop(){t++;g.fillStyle="#000";g.fillRect(0,0,320,420);
 if(!over){if(keys.ArrowLeft)P.x-=S.speed;if(keys.ArrowRight)P.x+=S.speed;
  if(tx){const r=c.getBoundingClientRect(),x=(tx.clientX-r.left)*320/r.width;P.x+=Math.sign(x-P.x)*Math.min(S.speed,Math.abs(x-P.x))}
  P.x=Math.max(10,Math.min(310,P.x));
  if((keys[" "]||tx)&&t%12==0)for(let i=0;i<S.shots;i++)B.push({x:P.x+(i-(S.shots-1)/2)*10,y:P.y-10});
  B.forEach(b=>b.y-=6);B=B.filter(b=>b.y>0);
  E.forEach(e=>{e.x+=Math.sin(t/30)*0.8;e.y+=0.15;B.forEach(b=>{if(Math.abs(b.x-e.x)<12&&Math.abs(b.y-e.y)<10){e.hp-=S.dmg;b.y=-99}})});
  E.forEach(e=>{const d=Math.hypot(e.x-P.x,e.y-P.y);if(S.pup&&d<90)bark=20;
   if(d<16&&e.hp>0){if(S.pup){e.hp=0;log("The puppy bit an enemy that got too close!")}else if(sh>0){sh--;e.hp=0;log("Armour blocked a hit. Shields left: "+sh)}else over=true}
   if(e.y>430)over=true});
  if(S.pup){let tg=null,bd=170;E.forEach(e=>{const d=Math.hypot(e.x-P.x,e.y-P.y);if(d<bd&&e.hp>0){bd=d;tg=e}});
   const hx=tg?tg.x:P.x+22,hy=tg?tg.y:P.y+5,dx=hx-D.x,dy=hy-D.y,dd=Math.hypot(dx,dy)||1,sp=tg?4:3;
   if(dd>2){D.x+=dx/dd*Math.min(sp,dd);D.y+=dy/dd*Math.min(sp,dd)}
   if(tg){bark=15;if(dd<12&&D.cd<=0){tg.hp=0;D.cd=20;log("The puppy ran up and bit an enemy! WOOF!")}}D.cd--}
  E=E.filter(e=>{if(e.hp<=0){score+=10;for(let k=0;k<6;k++)FX.push({x:e.x,y:e.y,vx:Math.random()*4-2,vy:Math.random()*4-2,l:14});return false}return true});if(!E.length)reset()}
 if(S.mat=="Plasma"||S.mat=="Neon"){g.save();g.shadowColor=S.color;g.shadowBlur=12;g.fillStyle=S.color;g.fillRect(P.x-8,P.y-6,16,12);g.restore()}g.fillStyle=S.color;g.fillRect(P.x-8,P.y-6,16,12);g.fillRect(P.x-2,P.y-12,4,6);
 if(sh>0){g.strokeStyle=S.mat=="Ice"?"rgba(200,255,255,"+(.6+.4*Math.sin(t/8))+")":S.color;g.beginPath();g.arc(P.x,P.y,16,0,7);g.stroke()}
 if(S.pup){g.fillStyle="#c96";g.fillRect(D.x-5,D.y-3,10,7);g.fillRect(D.x+3,D.y-6,4,4);g.fillStyle="#000";g.fillRect(D.x+5,D.y-5,1,1);if(bark>0){g.fillStyle="#fff";g.font="bold 12px monospace";g.fillText("WOOF!",D.x-14,D.y-10);g.font="10px sans-serif";bark--}}
 const M=S.mat;g.save();
 if(M=="Plasma"){g.shadowColor="#f4f";g.shadowBlur=10}
 if(M=="Neon"){g.shadowColor="#ff0";g.shadowBlur=6+4*Math.sin(t/6)}
 B.forEach(b=>{const w=M=="Plasma"?Math.sin((t+b.y)/4)*2:0;
  if(M=="Ice"){g.fillStyle="rgba(136,255,255,.3)";g.fillRect(b.x-1,b.y+8,3,8)}
  if(M=="Obsidian"){g.fillStyle="#222";g.fillRect(b.x-2,b.y,5,9);g.strokeStyle="#ccc";g.strokeRect(b.x-2,b.y,5,9);return}
  if(M=="Bone"){g.fillStyle=S.color;g.save();g.translate(b.x,b.y+4);g.rotate(b.y/10);g.fillRect(-4,-1,8,3);g.restore();return}
  g.fillStyle=S.color;g.fillRect(b.x-1+w,b.y,3,8)});
 g.restore();
 FX.forEach(f=>{f.x+=f.vx;f.y+=f.vy;f.l--;g.globalAlpha=f.l/14;g.fillStyle=S.color;g.fillRect(f.x,f.y,2,2)});g.globalAlpha=1;FX=FX.filter(f=>f.l>0).slice(-40);
 E.forEach(e=>{g.fillStyle=e.hp>1?"#f44":"#fa0";g.fillRect(e.x-8,e.y-5,16,10)});
 g.fillStyle="#cfe";g.fillText("Score "+score+(eq?"  Equipped: "+eq.name:"  No NFT equipped"),6,14);
 if(over)g.fillText("GAME OVER - tap to restart",85,210);
 requestAnimationFrame(loop)}loop();
