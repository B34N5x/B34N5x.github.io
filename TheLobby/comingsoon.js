// © B34N5. All rights reserved. Kiosk "Coming soon" board (static info only).
export function addComingSoon(interactables) {
  const css = document.createElement('style');
  css.textContent = `#csPanel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:60;background:rgba(5,4,15,.72);padding:max(12px,env(safe-area-inset-top)) 12px}
#csPanel.on{display:flex}#csPanel .b{position:relative;width:min(520px,94vw);max-height:88vh;overflow:auto;background:#120f24;border:2px solid #ff2a4d;box-shadow:0 0 18px #ff2a4d88,inset 0 0 12px #ff2a4d44;border-radius:12px;padding:20px 20px 16px;color:#e9e6ff;font-family:'Space Grotesk',system-ui,sans-serif}
#csPanel h2{margin:0 52px 4px 0;font-style:italic;letter-spacing:.06em;font-size:clamp(20px,5vw,28px);background:linear-gradient(180deg,#fff,#c9d6ff 45%,#ff9a3c 60%,#ff2a4d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 6px #ff2a4d88)}
#csPanel .t{font-size:13px;color:#7ef9ff;margin:0 0 12px}#csPanel ul{margin:0;padding-left:20px;line-height:1.5;font-size:clamp(14px,3.8vw,16px)}#csPanel li{margin-bottom:8px}
#csPanel .x{position:absolute;top:10px;right:10px;width:44px;height:44px;border-radius:10px;border:2px solid #ff2a4d;background:#1c1934;color:#fff;font-size:22px;cursor:pointer}
@media (min-width:1024px) and (min-height:600px){#csPanel .b{width:min(900px,60vw);padding:36px 40px 28px;border-radius:16px}#csPanel h2{font-size:clamp(36px,3vw,48px);margin-right:64px}#csPanel .t{font-size:18px;margin-bottom:20px}#csPanel ul{font-size:clamp(19px,1.2vw,22px);line-height:1.6;padding-left:26px}#csPanel li{margin-bottom:12px}#csPanel .x{width:52px;height:52px;font-size:26px;top:16px;right:16px}}`;
  document.head.appendChild(css);
  const p = document.createElement('div'); p.id = 'csPanel';
  p.innerHTML = `<div class="b" role="dialog" aria-label="Coming soon"><button class="x" aria-label="Close">✕</button><h2>COMING SOON</h2><p class="t">Testnet beta — updates roll out over time</p><ul>
<li>New sprites and improved avatar models, added as we secure licensing in future updates.</li><li>More weapon effects.</li>
<li>Customised daily side quests: solve a randomly generated riddle and print it as a card with your avatar holding it.</li></ul></div>`;
  document.body.appendChild(p);
  const close = () => p.classList.remove('on');
  p.querySelector('.x').addEventListener('click', close);
  p.addEventListener('click', e => { if (e.target === p) close(); });
  addEventListener('keydown', e => { if (e.code === 'Escape') close(); });
  const open = () => { p.classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); };
  interactables.push({ x: 5, z: 5, r: 2.4, hint: 'E: Kiosk — Coming soon', use: open });
  if (new URLSearchParams(location.search).has('comingsoon')) open();
  return open;
}
