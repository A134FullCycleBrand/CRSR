// (external script reserved for non-canvas features; canvas game runs inline in HTML)

// (minimal runner removed; inline game handles canvas rendering)

// === DEBUG: force-start loop and log ===
// (frame beacon removed)

// (legacy game start wrappers and post-render injection removed)


// (legacy season wave/ship module removed)

// (legacy ensureSeasonShipOnTop removed)

// (legacy boundary placer removed)

/* ========== Fix HUD + Canvas Resize ========== */
function fitCanvasToParent(canvas){
  try{
    if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    if(ctx && ctx.setTransform) ctx.setTransform(dpr,0,0,dpr,0,0);
  }catch(_){/* noop */}
}
const gameCanvasFix = document.getElementById('gameCanvas');
window.addEventListener('resize', ()=> fitCanvasToParent(gameCanvasFix), {passive:true});
fitCanvasToParent(gameCanvasFix);

// Ensure initialization after DOM ready as well
document.addEventListener('DOMContentLoaded', () => {
  const cvs = document.getElementById('gameCanvas');
  fitCanvasToParent(cvs);
  window.addEventListener('resize', () => fitCanvasToParent(cvs), {passive:true});
});

// Fullscreen fallback
document.querySelectorAll("[data-fullscreen]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const el=document.documentElement;
    if(el.requestFullscreen) el.requestFullscreen();
    else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });
});

// Live metrics demo tween
function updateMetric(id, min, max) {
  const el = document.getElementById(id);
  if (!el) return;
  // try to locate the progress bar within the same metric card
  const card = el.closest('.metric-card');
  const bar = card ? card.querySelector('.meter .meter-bar') : null;

  let current = parseInt((el.textContent||'').replace(/\D/g,"")) || min;
  const target = Math.floor(Math.random()*(max-min)+min);
  const step = (target-current)/30;
  let i=0;
  const interval=setInterval(()=>{
    current+=step; i++;
    const shown = Math.floor(current);
    el.textContent = shown;
    if (bar && isFinite(min) && isFinite(max) && max>min) {
      const ratio = Math.max(0, Math.min(1, (shown - min) / (max - min)));
      bar.style.width = (ratio * 100).toFixed(1) + '%';
    }
    if(i>=30) clearInterval(interval);
  },100);
}
// обновляем каждые 3с
setInterval(()=>{
  updateMetric("dau",1200,3000);
  updateMetric("mau",15000,40000);
  updateMetric("avgSession",5,20);
  updateMetric("activeHolders",300,3000);
  updateMetric("refPercent",10,40);
  updateMetric("avgClaim",3,11);
},3000);

/* ===== Season Progress — single source of truth ===== */
(function SeasonProgress(){
  const wrap = document.getElementById('seasonProgressWrap') || document.getElementById('seasonProgress');
  const DEMO_PROGRESS = false; // ← true для демо-анимации, false в проде
  const svg  = document.getElementById('seasonWave');
  const path = document.getElementById('railPath');
  const fill = document.getElementById('railFill');
  const flow = document.getElementById('railFlow');
  const ship = document.getElementById('railShip') || document.querySelector('.season-ship');
  if(!wrap || !svg || !path || !fill || !flow) return;

  svg.querySelectorAll('[data-ship], .ship, .ship-icon').forEach(n=>n.style.display='none');

  const ptsEl  = wrap.querySelector('[data-season-points]');
  const goalEl = wrap.querySelector('[data-season-goal]');
  // 0.2 cm ≈ 7.56 CSS px; используем 7.6 для упрощения
  const SHIP_FORWARD_OFFSET = 7.6;
  let W=0,H=0,A=12,K=0,phase=0,L=0;

  function getProgress(){
    // Используем только сезонные метки
    const ptsEl  = wrap.querySelector('[data-season-points]');
    const goalEl = wrap.querySelector('[data-season-goal]');
    const ptsMeta  = parseInt((ptsEl?.textContent||'0').replace(/\D/g,''),10) || 0;
    const goalMeta = Math.max(1, parseInt((goalEl?.textContent||'0').replace(/\D/g,''),10) || 1);
    return Math.max(0, Math.min(1, ptsMeta / goalMeta));
  }
  function size(){
    const rail = wrap.querySelector('.season-rail')||wrap;
    const r = rail.getBoundingClientRect();
    W = Math.max(320, Math.floor(r.width));
    H = Math.max(60,  Math.floor(r.height));
    A = Math.max(6, Math.min(14, Math.round(H*0.22)));
    const periods = Math.max(6, Math.round(W/160));
    K = (Math.PI*2*periods)/W;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }
  function wave(ph){
    const mid=H/2, step=6; let d=`M 0 ${mid}`;
    for(let x=0;x<=W;x+=step){ const y = mid + A*Math.sin(K*x+ph); d+=` L ${x} ${y}`; }

    // сперва кладём рельсу и flow, затем обновим fill сверху (слой уже в DOM перенесён)
    path.setAttribute('d', d);
    flow.setAttribute('d', d);
    fill.setAttribute('d', d);
    L = fill.getTotalLength();
    fill.style.strokeDasharray = `${L} ${L}`;
  }
  function setFill(p){ fill.style.strokeDashoffset = (L - p*L); }
  function placeShipFromProgress(p){
    if (!ship || !path || !svg || !L) return;
    let filledLen = Math.max(0, Math.min(L, p*L));
    // если fill задаёт dashoffset, берём его как истинный источник
    const cs = getComputedStyle(fill);
    const off = parseFloat((fill.style.strokeDashoffset || cs.strokeDashoffset || '').trim());
    if (Number.isFinite(off)) filledLen = Math.max(0, Math.min(L, L - off));
    const drawLen = Math.max(0, Math.min(L, filledLen + SHIP_FORWARD_OFFSET));
    const p1 = path.getPointAtLength(drawLen);
    const p2 = path.getPointAtLength(Math.min(L, drawLen + 0.6));
    const angleDeg = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180/Math.PI;
    const pt = svg.createSVGPoint(); pt.x = p1.x; pt.y = p1.y;
    const scr = pt.matrixTransform(path.getScreenCTM());
    const box = wrap.getBoundingClientRect();
    ship.style.left = (scr.x - box.left) + 'px';
    ship.style.top  = (scr.y - box.top ) + 'px';
    ship.style.transform = `translate(-50%,-50%) scaleX(-1) rotate(${angleDeg}deg)`;
  }
  function tick(t){
    phase += 0.0018*16; // wave phase
    wave(phase);
    // Вернули обычный flow без принудительной фазы
    flow.setAttribute('stroke-dashoffset', (phase*22)%180);
    const p = DEMO_PROGRESS ? (performance.now()/1000*0.05)%1 : getProgress();
    setFill(p);
    placeShipFromProgress(p);
    requestAnimationFrame(tick);
  }

  const ro=new ResizeObserver(()=>{ size(); wave(phase); const p=getProgress(); setFill(p); placeShipFromProgress(p); });
  ro.observe(wrap.querySelector('.season-rail')||wrap);
  ;[ptsEl,goalEl].forEach(n=>{ if(!n) return; new MutationObserver(()=>{ const p=getProgress(); setFill(p); placeShipFromProgress(p); }).observe(n,{childList:true,characterData:true,subtree:true}); });
  // HUD больше не источник прогресса; наблюдаем только сезонные метки

  size(); wave(0); const p0=getProgress(); setFill(p0); placeShipFromProgress(p0); requestAnimationFrame(tick);
})();

/* (removed duplicate ship placement module to avoid conflicts) */

// === Earn & Claim — demo module (isolated, conflict-free) ===
(function(){
  if (window.__CRSR_WALLET__ || window.__CRSR_DEMO_EARN__) return; // guard
  window.__CRSR_DEMO_EARN__ = true;

  document.addEventListener('DOMContentLoaded', function(){
    const els = {
      points:      document.getElementById('pointsSession'),
      claimable:   document.getElementById('claimable'),
      claimed:     document.getElementById('claimed'),
      connectBtn:  document.getElementById('connectWallet'),
      walletLabel: document.getElementById('walletLabel'),
      claimBtn:    document.getElementById('claimBtn'),
      claimMsg:    document.getElementById('claimMsg'),
      hudScore:    document.getElementById('hudScore') || document.getElementById('score')
    };
    if (!els.points || !els.claimable || !els.claimed || !els.connectBtn || !els.claimBtn) return;

    const PTS_PER_TOKEN = 100;               // 100 очк. = 1 CRSR
    let isConnected = false, addr = null, claimedTotal = 0;

    const short = a => a ? a.slice(0,6)+'…'+a.slice(-4) : '';
    const toNum = t => parseInt(String(t||'').replace(/[^\d]/g,''),10) || 0;
    const fmt   = v => (Math.floor(v*100)/100).toString();

    function getSessionPoints(){
      const hud = els.hudScore ? toNum(els.hudScore.textContent) : 0;
      return hud > 0 ? hud : toNum(els.points.textContent);
    }
    function computeClaimable(){ return getSessionPoints()/PTS_PER_TOKEN; }

    function redraw(){
      const pts   = getSessionPoints();
      const avail = computeClaimable();
      els.points.textContent    = String(pts);
      els.claimable.textContent = fmt(avail);
      els.claimed.textContent   = fmt(claimedTotal);

      els.connectBtn.textContent = isConnected ? 'ОТКЛЮЧИТЬ КОШЕЛЁК' : 'ПОДКЛЮЧИТЬ КОШЕЛЁК';
      if (els.walletLabel) els.walletLabel.textContent = isConnected ? `Подключен: ${short(addr)}` : 'Не подключен';
      els.claimBtn.disabled = !(isConnected && avail > 0);
    }

    els.connectBtn.addEventListener('click', () => {
      if (!isConnected){
        addr = '0x' + Math.random().toString(16).slice(2).padEnd(40,'0').slice(0,40);
        isConnected = true;
      } else {
        isConnected = false; addr = null;
      }
      redraw();
    });

    els.claimBtn.addEventListener('click', () => {
      if (els.claimBtn.disabled) return;
      const prev = els.claimBtn.textContent;
      els.claimBtn.textContent = 'Клеймим…'; els.claimBtn.disabled = true;
      if (els.claimMsg) els.claimMsg.textContent = '';
      setTimeout(()=>{
        const avail = computeClaimable();
        if (avail > 0){ claimedTotal += avail; }
        els.claimBtn.textContent = prev;
        if (els.claimMsg) els.claimMsg.textContent = 'Успех (демо)';
        redraw();
      }, 700);
    });

    if (els.hudScore){
      new MutationObserver(()=>redraw())
        .observe(els.hudScore, {childList:true, characterData:true, subtree:true});
    }
    redraw();
  });
})();
