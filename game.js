(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, FLOOR = 444;
  const chars = [
    { name: 'MICHAEL JACKSON', short: 'THE KING OF POP', color: '#20202b', accent: '#ffc95e', special: 'MOONWALK MIRAGE', hair: '#131018' },
    { name: 'LEBRON JAMES', short: 'THE COURT LEGEND', color: '#263c71', accent: '#ff678e', special: 'CROWN COURT SLAM', hair: '#161820' }
  ];
  let state = 'menu', selected = 0, twoPlayer = false, paused = false;
  let fighters = [], sparks = [], labels = [], keys = Object.create(null);
  let roundTime = 0, shake = 0, last = 0, soundOn = true, audio;
  const soundButton = document.getElementById('soundButton');

  function tone(freq = 220, duration = .08, type = 'triangle') {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(.055, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) { /* Audio is an optional enhancement. */ }
  }
  function makeFighter(kind, x, side) {
    return { kind, x, y: FLOOR, vx: 0, vy: 0, hp: 100, side, face: side === 0 ? 1 : -1,
      attack: 0, attackType: '', cooldown: 0, stun: 0, guard: false, jump: 0, walk: 0, wins: 0 };
  }
  function startRound() {
    fighters = [makeFighter(selected, 286, 0), makeFighter(twoPlayer ? 1 - selected : 1 - selected, 674, 1)];
    fighters[0].wins = fighters[1].wins = 0;
    sparks = []; labels = []; roundTime = 0; paused = false; state = 'fight';
    tone(440, .15); 
  }
  function menu() { state = 'menu'; paused = false; keys = Object.create(null); }
  function pressed(key) { return !!keys[key]; }
  function action(f, kind) {
    if (state !== 'fight' || paused || f.cooldown > 0 || f.stun > 0) return;
    f.attack = kind === 'special' ? .48 : kind === 'power' ? .38 : .25;
    f.attackType = kind; f.cooldown = kind === 'special' ? .78 : kind === 'power' ? .58 : .36;
    tone(kind === 'special' ? 510 : kind === 'power' ? 180 : 300, .09, kind === 'power' ? 'sawtooth' : 'triangle');
  }
  function hit(attacker, defender) {
    if (attacker.attack <= 0 || attacker.attack > (attacker.attackType === 'special' ? .34 : attacker.attackType === 'power' ? .26 : .16)) return;
    const distance = Math.abs(attacker.x - defender.x);
    if (distance > (attacker.attackType === 'special' ? 138 : attacker.attackType === 'power' ? 112 : 92) || attacker.face * (defender.x - attacker.x) < -10) return;
    attacker.attack = 0;
    const blocked = defender.guard && defender.y === FLOOR;
    const damage = blocked ? 2 : attacker.attackType === 'special' ? 19 : attacker.attackType === 'power' ? 13 : 7;
    defender.hp = Math.max(0, defender.hp - damage);
    defender.stun = blocked ? .12 : .27;
    defender.vx = attacker.face * (blocked ? 85 : attacker.attackType === 'power' ? 250 : 175);
    if (!blocked && attacker.attackType === 'special') defender.vy = -125;
    shake = blocked ? 2 : attacker.attackType === 'power' ? 8 : 5;
    sparks.push({ x: (attacker.x + defender.x) / 2, y: FLOOR - (defender.y < FLOOR ? 40 : 84), life: .32, color: blocked ? '#8bdcff' : chars[attacker.kind].accent, r: 12 });
    labels.push({ x: defender.x, y: FLOOR - 100, text: blocked ? 'GUARD!' : `${damage} HIT`, color: blocked ? '#9bddff' : '#fff' });
    tone(blocked ? 100 : 95, .12, 'square');
    if (defender.hp <= 0) finish(attacker.side === 0 ? 'P1' : 'P2');
  }
  function finish(winner) { state = 'over'; window.winner = winner; tone(winner === 'P1' ? 660 : 130, .4, 'sawtooth'); }
  function update(dt) {
    if (state !== 'fight' || paused) return;
    roundTime += dt;
    const p1 = fighters[0], p2 = fighters[1];
    for (const f of fighters) {
      f.cooldown = Math.max(0, f.cooldown - dt); f.attack = Math.max(0, f.attack - dt);
      f.stun = Math.max(0, f.stun - dt); f.guard = false;
      if (f.y < FLOOR || f.vy < 0) { f.vy += 900 * dt; f.y += f.vy * dt; if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; } }
      f.x += f.vx * dt; f.vx *= Math.pow(.001, dt); f.x = Math.max(90, Math.min(870, f.x));
    }
    function control(f, left, right, jump, block, quick, power, special, cpu = false) {
      if (f.stun > 0) return;
      if (cpu) {
        const gap = Math.abs(p2.x - p1.x), dir = Math.sign(p1.x - p2.x);
        f.guard = gap < 120 && Math.random() < .32;
        if (gap > 90) f.vx = dir * 118;
        else if (f.cooldown <= 0 && Math.random() < .055) action(f, Math.random() < .18 ? 'special' : Math.random() < .5 ? 'power' : 'quick');
        if (gap < 175 && Math.random() < .006 && f.y === FLOOR) f.vy = -420;
        return;
      }
      const dir = (pressed(right) ? 1 : 0) - (pressed(left) ? 1 : 0);
      f.guard = pressed(block) && dir === 0;
      if (dir && !f.guard) { f.vx = dir * 215; f.walk += dt * 12; }
      if (pressed(jump) && f.y === FLOOR && !f._jumpLock) { f.vy = -475; f._jumpLock = true; tone(380, .07); }
      if (!pressed(jump)) f._jumpLock = false;
      if (pressed(quick)) action(f, 'quick'); if (pressed(power)) action(f, 'power'); if (pressed(special)) action(f, 'special');
    }
    control(p1, 'a', 'd', 'w', 's', 'f', 'g', 'h');
    if (twoPlayer) control(p2, 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'j', 'k', 'l');
    else control(p2, '', '', '', '', '', '', '', true);
    p1.face = p1.x < p2.x ? 1 : -1; p2.face = -p1.face;
    hit(p1, p2); hit(p2, p1);
    if (roundTime >= 60) finish(p1.hp === p2.hp ? 'DRAW' : p1.hp > p2.hp ? 'P1' : 'P2');
    sparks.forEach(p => { p.life -= dt; p.y -= 35 * dt; }); sparks = sparks.filter(p => p.life > 0);
    labels.forEach(t => { t.y -= 38 * dt; t.life = (t.life ?? .7) - dt; }); labels = labels.filter(t => t.life > 0);
    shake = Math.max(0, shake - 24 * dt);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function arena() {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#151226'); sky.addColorStop(.58, '#302445'); sky.addColorStop(1, '#100d18');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffc95e'; ctx.globalAlpha = .12; ctx.beginPath(); ctx.ellipse(480, 86, 285, 190, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    for (let i = 0; i < 13; i++) { const x = 26 + i * 76; ctx.fillStyle = i % 2 ? '#ee477e' : '#ffd36e'; ctx.globalAlpha = .24; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(480 + (x - 480) * .17, 384); ctx.lineTo(480 + (x + 24 - 480) * .17, 384); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#17101f'; ctx.fillRect(0, 329, W, 115);
    for (let i = 0; i < 26; i++) { const x = (i * 43 + 13) % W, y = 347 + (i * 29) % 70; ctx.fillStyle = i % 3 ? '#4c3b5c' : '#d9507b'; ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3), 0, 6.28); ctx.fill(); }
    ctx.strokeStyle = '#e9b65b55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 444); ctx.lineTo(W, 444); ctx.stroke();
    const floor = ctx.createLinearGradient(0, 444, 0, H); floor.addColorStop(0, '#282034'); floor.addColorStop(1, '#100d18'); ctx.fillStyle = floor; ctx.fillRect(0, 445, W, 95);
    for (let i = -7; i < 9; i++) { ctx.strokeStyle = '#a4829b22'; ctx.beginPath(); ctx.moveTo(480, 444); ctx.lineTo(i * 100 + 480, 540); ctx.stroke(); }
    if (state !== 'menu') { ctx.fillStyle = '#ffc95e'; ctx.globalAlpha = .8; ctx.font = '700 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('ICON ARENA  •  LOS ANGELES', 480, 423); ctx.globalAlpha = 1; }
  }
  function fighter(f) {
    const c = chars[f.kind], x = f.x, y = f.y, lift = FLOOR - y, dir = f.face;
    ctx.save(); ctx.translate(x, y - lift); ctx.scale(dir, 1);
    ctx.globalAlpha = .3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 2, 35, 8, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
    const moving = Math.abs(f.vx) > 20, stride = moving ? Math.sin(f.walk) * 8 : 0;
    ctx.strokeStyle = '#11101a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9, -38); ctx.lineTo(-13 + stride, -7); ctx.lineTo(-20 + stride, -2); ctx.moveTo(9, -38); ctx.lineTo(14 - stride, -7); ctx.lineTo(22 - stride, -2); ctx.stroke();
    ctx.fillStyle = c.color; roundRect(-19, -93, 38, 57, 10); ctx.fill();
    ctx.fillStyle = c.accent; ctx.fillRect(-18, -52, 36, 4);
    ctx.fillStyle = '#b77c59'; ctx.beginPath(); ctx.arc(0, -108, 15, 0, 6.28); ctx.fill();
    ctx.fillStyle = c.hair; ctx.beginPath(); ctx.arc(0, -114, 16, Math.PI, 6.2); ctx.fill();
    if (f.kind === 0) { ctx.fillStyle = '#17121b'; ctx.beginPath(); ctx.moveTo(-14,-117); ctx.lineTo(-27,-132); ctx.lineTo(-17,-111); ctx.fill(); }
    else { ctx.fillStyle = '#15141c'; roundRect(-15, -119, 30, 7, 3); ctx.fill(); }
    ctx.fillStyle = '#ffe4b2'; ctx.fillRect(4, -108, 3, 2);
    ctx.strokeStyle = '#b77c59'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-14, -82); ctx.lineTo(-23, -61); ctx.lineTo(-31, -59); ctx.moveTo(14, -82); ctx.lineTo(24, -65); ctx.lineTo(34, -68); ctx.stroke();
    if (f.attack > 0) { ctx.strokeStyle = c.accent; ctx.lineWidth = f.attackType === 'special' ? 8 : 5; ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(40, -74, f.attackType === 'special' ? 43 : 31, -.9, .8); ctx.stroke(); ctx.globalAlpha = 1; }
    if (f.guard) { ctx.strokeStyle = '#9bddff'; ctx.lineWidth = 3; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(0, -72, 39, -1.5, 1.5); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function bar(x, y, w, hp, color, flip = false) {
    ctx.fillStyle = '#0c0a12'; roundRect(x, y, w, 15, 7); ctx.fill();
    ctx.fillStyle = color; const width = Math.max(0, (w - 4) * hp / 100);
    roundRect(flip ? x + w - 2 - width : x + 2, y + 2, width, 11, 5); ctx.fill();
  }
  function hud() {
    if (!fighters.length) return;
    const [a, b] = fighters;
    ctx.fillStyle = '#0b0913cc'; roundRect(24, 20, 912, 58, 12); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = chars[a.kind].accent; ctx.font = '800 12px sans-serif'; ctx.fillText(twoPlayer ? 'PLAYER 1' : 'YOU', 40, 42);
    ctx.fillStyle = '#fff'; ctx.font = '700 12px sans-serif'; ctx.fillText(chars[a.kind].name, 40, 63);
    bar(215, 31, 250, a.hp, chars[a.kind].accent);
    ctx.textAlign = 'right'; ctx.fillStyle = chars[b.kind].accent; ctx.font = '800 12px sans-serif'; ctx.fillText(twoPlayer ? 'PLAYER 2' : 'CPU RIVAL', 920, 42);
    ctx.fillStyle = '#fff'; ctx.font = '700 12px sans-serif'; ctx.fillText(chars[b.kind].name, 920, 63);
    bar(495, 31, 250, b.hp, chars[b.kind].accent, true);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffc95e'; ctx.font = '900 21px monospace'; ctx.fillText(String(Math.max(0, 60 - Math.floor(roundTime))).padStart(2, '0'), 480, 53);
  }
  function overlay() {
    ctx.fillStyle = '#08071077'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffc95e'; ctx.font = '700 11px monospace'; ctx.fillText('THE SHOWDOWN STARTS HERE', 480, 91);
    ctx.fillStyle = '#fff'; ctx.font = '900 70px sans-serif'; ctx.fillText('LEGENDS', 480, 160);
    ctx.fillStyle = '#d5ccdf'; ctx.font = '600 12px monospace'; ctx.fillText('ICON CLASH', 480, 183);
    chars.forEach((c, i) => { const x = i ? 639 : 321, chosen = selected === i;
      ctx.fillStyle = chosen ? '#29203a' : '#171424'; ctx.strokeStyle = chosen ? c.accent : '#655875'; ctx.lineWidth = chosen ? 2 : 1;
      roundRect(x - 133, 224, 266, 115, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.color; ctx.fillRect(x - 133, 224, 4, 115);
      ctx.fillStyle = c.accent; ctx.font = '700 8px monospace'; ctx.fillText(chosen ? '★ YOUR FIGHTER' : 'ICON', x, 244);
      ctx.fillStyle = '#fff'; ctx.font = '900 25px sans-serif'; ctx.fillText(c.name, x, 280);
      ctx.fillStyle = '#b9b0c6'; ctx.font = '9px monospace'; ctx.fillText(c.short, x, 302);
      ctx.fillStyle = c.accent; ctx.font = '700 9px monospace'; ctx.fillText(c.special, x, 323);
    });
    ctx.fillStyle = '#b9b0c6'; ctx.font = '10px monospace'; ctx.fillText('←  →   CHOOSE FIGHTER', 480, 374);
    ctx.fillStyle = chars[selected].accent; roundRect((selected ? 639 : 321) - 70, 390, 140, 31, 6); ctx.fill();
    ctx.fillStyle = '#181222'; ctx.font = '800 10px monospace'; ctx.fillText('PICKED  ✓', selected ? 639 : 321, 410);
    ctx.fillStyle = '#fff'; ctx.font = '700 13px monospace'; ctx.fillText('PRESS ENTER TO FIGHT', 480, 472);
    ctx.fillStyle = '#a89fb5'; ctx.font = '9px monospace'; ctx.fillText(`${twoPlayer ? 'TWO PLAYER LOCAL' : 'CPU SHOWDOWN'}  •  ARCADE MODE`, 480, 494);
    ctx.fillStyle = '#6b6178'; ctx.fillText(twoPlayer ? 'P1 A/D/W/S/F/G/H  •  P2 ←/→/↑/↓/J/K/L' : 'P  TWO PLAYER  /  ENTER  START', 480, 514);
  }
  function draw() {
    ctx.save(); if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    arena();
    if (state === 'menu') overlay();
    else {
      hud(); fighters.forEach(fighter);
      for (const p of sparks) { ctx.globalAlpha = Math.max(0, p.life / .32); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const t of labels) { ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = t.color; ctx.textAlign = 'center'; ctx.font = '900 22px sans-serif'; ctx.fillText(t.text, t.x, t.y); }
      ctx.globalAlpha = 1;
      if (state === 'fight' && roundTime < 2.1) { ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 42px sans-serif'; ctx.fillText(roundTime < .9 ? 'FIGHT!' : 'ROUND 1', 480, 180); }
      if (paused) { ctx.fillStyle = '#080710bb'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#ffc95e'; ctx.font = '900 48px sans-serif'; ctx.fillText('PAUSED', 480, 240); ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.fillText('PRESS P OR ENTER TO RESUME', 480, 272); }
      if (state === 'over') { ctx.fillStyle = '#080710aa'; ctx.fillRect(0, 0, W, H); const w = window.winner;
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffc95e'; ctx.font = '700 10px monospace'; ctx.fillText(w === 'DRAW' ? 'TIME UP' : 'THE SPOTLIGHT BELONGS TO', 480, 179);
        ctx.fillStyle = '#fff'; ctx.font = '900 54px sans-serif'; ctx.fillText(w === 'DRAW' ? 'DRAW' : chars[fighters[w === 'P1' ? 0 : 1].kind].name, 480, 239);
        ctx.fillStyle = '#dbd3e2'; ctx.font = '11px monospace'; ctx.fillText(w === 'P1' ? 'VICTORY • A LEGEND IS CROWNED' : w === 'P2' ? 'DEFEAT • THE CROWD WANTS A REMATCH' : 'AN EVENLY MATCHED SHOWDOWN', 480, 267);
        ctx.fillStyle = '#ffc95e'; ctx.font = '700 12px monospace'; ctx.fillText('ENTER  REMATCH', 480, 330); ctx.fillStyle = '#aaa1b7'; ctx.font = '9px monospace'; ctx.fillText('ESC  CHARACTER SELECT', 480, 354);
      }
    }
    ctx.restore();
  }
  function loop(now) { const dt = Math.min(.035, (now - last) / 1000 || 0); last = now; update(dt); draw(); requestAnimationFrame(loop); }
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase(); if (['arrowleft','arrowright','arrowup','arrowdown',' '].includes(key)) e.preventDefault();
    if (keys[key]) return; keys[key] = true;
    if (state === 'menu') {
      if (key === 'arrowleft' || key === 'a') { selected = 0; tone(280); }
      if (key === 'arrowright' || key === 'd') { selected = 1; tone(280); }
      if (key === 'p') { twoPlayer = !twoPlayer; tone(350); }
      if (key === 'enter' || key === ' ') startRound();
    } else if (state === 'over') {
      if (key === 'escape') menu(); else if (key === 'enter' || key === ' ') startRound();
    } else if (key === 'escape') menu();
    else if (key === 'p' || key === 'enter') paused = !paused;
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { keys = Object.create(null); if (state === 'fight') paused = true; });
  soundButton.addEventListener('click', () => { soundOn = !soundOn; soundButton.innerHTML = `♫ <span>${soundOn ? 'ON' : 'OFF'}</span>`; if (soundOn) tone(440); });
  document.querySelectorAll('.mobile-controls button').forEach(button => {
    const key = button.dataset.key;
    const down = e => { e.preventDefault(); keys[key] = true; button.classList.add('active'); };
    const up = e => { e.preventDefault(); keys[key] = false; button.classList.remove('active'); };
    button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
  });
  requestAnimationFrame(loop);
})();
