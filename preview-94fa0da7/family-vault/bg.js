const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const c=document.getElementById('rain'),x=c.getContext('2d');let cols=[];
function size(){c.width=innerWidth;c.height=innerHeight;cols=Array(Math.ceil(c.width/16)).fill(0).map(()=>Math.random()*c.height/16)}
// Family silhouettes formed from rain glyphs (original simple vector shapes, drawn to an offscreen mask).
const m=document.createElement('canvas'),mx=m.getContext('2d'),sc=document.getElementById('sil'),sx=sc.getContext('2d');let cells=[],poseN=0;
// Poses: M=adult (trousers), F=adult (dress), C=child, T=parent carrying a toddler.
// Poses (original vector artwork): M/F = parent, C = child, T = parent carrying a toddler.
const POSES=[['M','C','C','F'],['T'],['F','C'],['M','C','F'],['M','T','C']];
const m0=document.createElement('canvas'),m0x=m0.getContext('2d'),gc=document.createElement('canvas'),gx=gc.getContext('2d');let bbox=[0,0,0,0];
function limb(x1,y1,x2,y2,x3,y3,w){mx0.lineWidth=w;mx0.beginPath();mx0.moveTo(x1,y1);mx0.quadraticCurveTo(x2,y2,x3,y3);mx0.stroke()}
let mx0=m0x;
// Smooth human figure. h = full height, hands = [left,right] target points or null.
function person(cx,base,h,k,hands){const child=k=='C',hr=h*(child?.085:.062),top=base-h;
 const shY=top+hr*2.25+h*.035,shW=h*(child?.105:.115),hipY=base-h*(child?.47:.5),hipW=h*(child?.075:.08);
 mx0.beginPath();mx0.ellipse(cx,top+hr,hr*.9,hr,0,0,7);mx0.fill();// head
 mx0.fillRect(cx-hr*.35,top+hr*1.7,hr*.7,hr*.8);// neck
 mx0.beginPath();mx0.moveTo(cx-shW,shY+h*.01);mx0.quadraticCurveTo(cx-shW,shY-h*.02,cx-shW*.6,shY-h*.015);mx0.lineTo(cx+shW*.6,shY-h*.015);
 mx0.quadraticCurveTo(cx+shW,shY-h*.02,cx+shW,shY+h*.01);
 if(k=='F'){mx0.quadraticCurveTo(cx+shW*.75,hipY-h*.08,cx+hipW*.85,hipY-h*.04);mx0.quadraticCurveTo(cx+hipW*2,base-h*.3,cx+hipW*2.1,base-h*.2);mx0.lineTo(cx-hipW*2.1,base-h*.2);mx0.quadraticCurveTo(cx-hipW*2,base-h*.3,cx-hipW*.85,hipY-h*.04);mx0.quadraticCurveTo(cx-shW*.75,hipY-h*.08,cx-shW,shY+h*.01)}
 else{mx0.quadraticCurveTo(cx+shW*.85,hipY-h*.12,cx+hipW,hipY);mx0.lineTo(cx-hipW,hipY);mx0.quadraticCurveTo(cx-shW*.85,hipY-h*.12,cx-shW,shY+h*.01)}
 mx0.closePath();mx0.fill();
 const lw=h*(child?.062:.058);// legs
 [-1,1].forEach(sg=>{const sx0=cx+sg*hipW*.5;limb(sx0,hipY-h*.01,sx0+sg*h*.012,base-h*.24,sx0+sg*h*.02,base-h*.02,lw);
  mx0.beginPath();mx0.ellipse(sx0+sg*h*.03,base-h*.012,lw*.75,lw*.35,0,0,7);mx0.fill()});
 const aw=h*(child?.048:.042);// arms
 [-1,1].forEach((sg,i)=>{const ax=cx+sg*shW*.85,ay=shY+h*.015,tg=hands&&hands[i];
  const hx=tg?tg[0]:cx+sg*shW*1.15,hy=tg?tg[1]:base-h*.5;
  limb(ax,ay,(ax+hx)/2+sg*h*.025,(ay+hy)/2,hx,hy,aw);mx0.beginPath();mx0.arc(hx,hy,aw*.62,0,7);mx0.fill()});
 return {hand:base-h*.47}}
function toddler(cx,base,h){// small child held on the parent's hip
 const th=h*.38,tx=cx+h*.13,ty=base-h*.58;const hr=th*.12;
 mx0.beginPath();mx0.ellipse(tx,ty-th*.58,hr*.9,hr,0,0,7);mx0.fill();
 mx0.beginPath();mx0.ellipse(tx,ty-th*.25,th*.13,th*.2,.15,0,7);mx0.fill();
 limb(tx,ty-th*.08,tx-th*.2,ty+th*.02,tx-th*.32,ty+th*.12,th*.09);limb(tx+th*.04,ty-th*.06,tx+th*.12,ty+th*.12,tx+th*.04,ty+th*.28,th*.09);
 limb(tx-th*.08,ty-th*.38,tx-th*.22,ty-th*.42,tx-th*.32,ty-th*.48,th*.07);// arm around parent
 return [tx-th*.05,ty+th*.02]}
function buildMask(){m.width=m0.width=gc.width=sc.width=c.width;m.height=m0.height=gc.height=sc.height=c.height;
 mx0.clearRect(0,0,m0.width,m0.height);mx0.fillStyle=mx0.strokeStyle='#fff';mx0.lineCap='round';mx0.lineJoin='round';
 const pose=POSES[poseN%POSES.length],side=poseN%2,n=pose.length,hasT0=pose.includes("T"),gf=n>3?.19:(hasT0&&n>1?.27:.22),hasT=pose.includes('T');
 // Fit the whole group into the free space beside the cards (cards ~880px wide, centred).
 const sd=Math.max(0,(c.width-880)/2),narrow=sd<120,avail=narrow?c.width*.9:sd-28;
 const L=.17,R=hasT?.3:.17,span=(n-1)*gf+L+R;// group width in units of H
 const H=Math.min(c.height*.72,avail/span),base=c.height*.97,gap=H*gf,gw=gap*(n-1);
 let x0=narrow?(c.width-span*H)/2+L*H:(side?c.width-sd+14:14)+(avail-span*H)/2+L*H;
 const hs=pose.map(k=>k=='C'?H*.6:H),xs=pose.map((k,i)=>x0+i*gap);
 const meet=pose.map((k,i)=>i<pose.length-1?[(xs[i]+xs[i+1])/2,(base-hs[i]*.47+base-hs[i+1]*.47)/2]:null);
 pose.forEach((k,i)=>{let L=i?meet[i-1]:null,R=meet[i];if(k=='T')R=[xs[i]+hs[i]*.1,base-hs[i]*.55];
  person(xs[i],base,hs[i],k=='T'?'F':k,[L,R]);if(k=='T')toddler(xs[i],base,hs[i])});
 const mx_=m.getContext('2d');mx_.clearRect(0,0,m.width,m.height);mx_.filter='blur('+Math.max(3,H*.012)+'px)';mx_.drawImage(m0,0,0);mx_.filter='none';
 bbox=[Math.max(0,x0-H*.35),Math.max(0,base-H*1.05),Math.min(c.width,x0+gw+H*.35),c.height];gx.clearRect(0,0,gc.width,gc.height)}
const CYCLE=20000,T0=performance.now()-0;
function silStrength(t){const p=t%CYCLE;if(p<12500)return 0;if(p<13500)return (p-12500)/1000;if(p<18500)return 1;return Math.max(0,1-(p-18500)/1500)}
let lastCycle=-1;
function drawSil(S){gx.globalCompositeOperation='destination-out';gx.fillStyle='rgba(0,0,0,.2)';gx.fillRect(0,0,gc.width,gc.height);gx.globalCompositeOperation='source-over';
 sx.clearRect(0,0,sc.width,sc.height);if(S<=0)return;const [x1,y1,x2,y2]=bbox,n=Math.floor((x2-x1)*(y2-y1)/150*S);gx.font='bold 10px monospace';
 for(let i=0;i<n;i++){const px=x1+Math.floor(Math.random()*(x2-x1)/8)*8,py=y1+Math.random()*(y2-y1);gx.fillStyle=`rgba(${200+Math.random()*40|0},255,${215+Math.random()*30|0},${.5+.5*Math.random()})`;gx.fillText(String.fromCharCode(0x30A0+Math.random()*96),px,py)}
 sx.globalAlpha=.3*S;sx.drawImage(m,0,0);sx.globalAlpha=1;// soft body glow
 sx.drawImage(gc,0,0);sx.globalCompositeOperation='destination-in';sx.drawImage(m,0,0);sx.globalCompositeOperation='source-over';sx.globalAlpha=1}
size();buildMask();addEventListener('resize',()=>{size();buildMask()});
function col(y,a){const t=Math.min(1,y/c.height);const r=Math.round(95+t*110),g=Math.round(255-t*55),b=Math.round(140+t*90);return `rgba(${r},${g},${b},${a})`}
function draw(fade){x.globalCompositeOperation='destination-out';x.fillStyle='rgba(0,0,0,.1)';x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='source-over';x.font='bold 15px monospace';
cols.forEach((y,i)=>{const py=y*16,ch=String.fromCharCode(0x30A0+Math.random()*96);x.fillStyle=col(py-16,.7);x.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*16,py-16);x.fillStyle=col(py,1);x.fillStyle=py<c.height*.5?'#d8ffe6':col(py,1);x.fillText(ch,i*16,py);cols[i]=py>c.height&&Math.random()>.975?0:y+1})}
if(rm){for(let i=0;i<60;i++)draw(true);for(let i=0;i<8;i++)drawSil(.6);document.body.className=''}
else{setInterval(()=>{draw(true);const t=performance.now()-T0,cy=Math.floor(t/CYCLE);if(cy!==lastCycle){lastCycle=cy;poseN=cy;buildMask()}const S=silStrength(t);if(S>0){x.globalCompositeOperation='destination-out';x.globalAlpha=.55*S;x.drawImage(m,0,0);x.globalAlpha=1;x.globalCompositeOperation='source-over'}drawSil(S)},110);setTimeout(()=>document.body.className='glitch',500)}
