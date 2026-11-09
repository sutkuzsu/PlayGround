(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const radar = document.getElementById('radar');
  const rctx = radar.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = { blue: $('blueScore'), orange: $('orangeScore'), clock: $('clock'), status: $('matchStatus'), notice: $('centerNotice'), mass: $('massValue'), rank: $('massRank'), fill: $('massFill'), orbs: $('orbsCollected'), boost: $('boostFill'), percent: $('boostPercent'), ready: $('boostReady'), flash: $('goalFlash'), boostToast: $('boostToast'), multiplier: $('scoreMultiplier'), toast: $('toast') };
  const W = 1200, H = 600;
  const keys = new Set();
  let state = 'menu', last = 0, timeLeft = 120, blueScore = 0, orangeScore = 0, shake = 0;
  let player, bots = [], ball, orbs = [], particles = [];
  let soundOn = false, audioCtx, toastTimer, flashTimer, boostNoticeTimer;
  let touch = {x:0,y:0,boost:false,active:false};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const len=(x,y)=>Math.hypot(x,y)||1;
  const norm=(x,y)=>{const l=len(x,y);return [x/l,y/l]};
  const resize=()=>{const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0)};
  window.addEventListener('resize',resize); resize();
  function makeCar(x,y,team,angle,isPlayer=false,index=0){return {x,y,vx:0,vy:0,angle,team,isPlayer,index,mass:1,boost:isPlayer?100:75,orbs:0,radius:14,hit:0,aiTimer:0}}
  function resetMatch(){
    timeLeft=120;blueScore=0;orangeScore=0;ui.blue.textContent='0';ui.orange.textContent='0';
    player=makeCar(W*.31,H*.5,'blue',0,true);bots=[makeCar(W*.25,H*.35,'blue',.2,false,0),makeCar(W*.74,H*.34, 'orange',Math.PI,false,0),makeCar(W*.76,H*.66,'orange',Math.PI,false,1)];
    ball={x:W/2,y:H/2,vx:0,vy:0,r:13,spin:0};orbs=[];particles=[];
    for(let i=0;i<34;i++)spawnOrb();updateStats();
  }
  function spawnOrb(){let x,y;for(let i=0;i<15;i++){x=rand(75,W-75);y=rand(55,H-55);if(!player||Math.hypot(x-player.x,y-player.y)>80)break}orbs.push({x,y,r:rand(4,6),phase:rand(0,7),value:1})}
  resetMatch();
  function startMatch(){if(state==='playing')return; if(state==='ended')resetMatch();state='playing';ui.notice.classList.add('hidden');ui.status.textContent='IN PLAY';ui.status.style.color='var(--cyan)';ui.status.style.borderColor='#54f4e52b';last=performance.now();playSound('start')}
  function endMatch(){state='ended';ui.notice.classList.remove('hidden');ui.notice.querySelector('.notice-kicker').textContent=blueScore===orangeScore?'FULL TIME':'MATCH COMPLETE';ui.notice.querySelector('h1').innerHTML=blueScore===orangeScore?'NICE<br><em>DRAW.</em>':blueScore>orangeScore?'YOU<br><em>WIN.</em>':'THEY<br><em>GOT YOU.</em>';ui.notice.querySelector('p').textContent=`FINAL SCORE  ${blueScore} — ${orangeScore}`;ui.notice.querySelector('.primary-btn').innerHTML='PLAY AGAIN <span>↗</span>';ui.notice.querySelector('.notice-foot').innerHTML='PRESS <kbd>ENTER</kbd> TO REMATCH';ui.status.textContent='FULL TIME';playSound(blueScore>orangeScore?'win':'lose')}
  function goal(team){if(state!=='playing')return;if(team==='blue')blueScore++;else orangeScore++;ui.blue.textContent=blueScore;ui.orange.textContent=orangeScore;ui.flash.classList.add('show');ui.flash.querySelector('span').textContent='GOAL!';ui.flash.querySelector('small').textContent=team==='blue'?'CYAN CREW SCORES':'EMBER CLUB SCORES';shake=18;playSound('goal');for(let i=0;i<45;i++)burst(W/2,H/2,team==='blue'?'#54f4e5':'#ff8759');clearTimeout(flashTimer);flashTimer=setTimeout(()=>ui.flash.classList.remove('show'),1250);setTimeout(()=>kickoff(team==='orange'),500);if(blueScore>=5||orangeScore>=5)setTimeout(endMatch,1250)}
  function kickoff(blueAdvantage){ball.x=W/2;ball.y=H/2;ball.vx=blueAdvantage?170:-170;ball.vy=rand(-55,55);player.x=W*.30;player.y=H/2;player.vx=player.vy=0;bots[0].x=W*.25;bots[0].y=H*.34;bots[1].x=W*.75;bots[1].y=H*.35;bots[2].x=W*.75;bots[2].y=H*.65}
  function updateStats(){if(!player)return;const m=player.mass;ui.mass.textContent=m.toFixed(1);ui.fill.style.width=`${((m-1)/2)*100}%`;ui.orbs.textContent=`${player.orbs} ORBS COLLECTED`;ui.rank.textContent=m>=2.7?'MEGA':m>=2.1?'TANK':m>=1.5?'RACER':'ROOKIE';ui.multiplier.textContent=`${m.toFixed(1)}×`;ui.boost.style.width=`${player.boost}%`;ui.percent.innerHTML=`${Math.round(player.boost)}<span>%</span>`;ui.ready.textContent=player.boost>=25?'READY':'RECHARGING';ui.ready.classList.toggle('empty',player.boost<25)}
  function playSound(type){if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);let f=type==='goal'?420:type==='boost'?180:type==='start'?520:280;osc.frequency.setValueAtTime(f,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(f*(type==='goal'?1.7:.65),audioCtx.currentTime+.18);gain.gain.setValueAtTime(.055,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.22);osc.start();osc.stop(audioCtx.currentTime+.23)}catch(_){}}
  function announce(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1300)}
  function burst(x,y,color){particles.push({x,y,vx:rand(-230,230),vy:rand(-200,200),life:rand(.35,.8),max:.8,r:rand(2,5),color})}
  function drive(car,dt,playerControlled){
    let ix=0,iy=0,boosting=false;
    if(playerControlled){ix=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);iy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);boosting=keys.has(' ')||keys.has('shift')||touch.boost;
      if(touch.active){ix=touch.x;iy=touch.y}
      if(ix||iy){const desired=Math.atan2(iy,ix);let diff=((desired-car.angle+Math.PI*3)%(Math.PI*2))-Math.PI;car.angle+=clamp(diff,-4.5*dt,4.5*dt)}
    }else{
      car.aiTimer-=dt;if(car.aiTimer<=0){car.aiTimer=rand(.28,.65);let targetX,targetY;
        if(car.team==='orange'){targetX=ball.x+(ball.x<W*.7?42:-24);targetY=ball.y+(car.index===0?-22:22)}
        else{targetX=ball.x-75;targetY=ball.y+(car.index===0?-60:55)}
        car.target=[targetX,targetY]}
      const target=car.target||[ball.x,ball.y];const dx=target[0]-car.x,dy=target[1]-car.y;const desired=Math.atan2(dy,dx);let diff=((desired-car.angle+Math.PI*3)%(Math.PI*2))-Math.PI;car.angle+=clamp(diff,-3.3*dt,3.3*dt);ix=Math.abs(diff)<1.9?1:.18;boosting=car.team==='orange'&&Math.abs(diff)<.45&&car.boost>35&&Math.hypot(dx,dy)>180;
    }
    const aligned=playerControlled?(ix||iy?1:0):ix;const base=playerControlled?250:205;const boostAllowed=boosting&&car.boost>0;const accel=base*(boostAllowed?2.25:1)*aligned;
    if(boostAllowed){car.boost=Math.max(0,car.boost-(playerControlled?42:25)*dt);if(playerControlled&&Math.random()<dt*14)burst(car.x-Math.cos(car.angle)*15,car.y-Math.sin(car.angle)*15,'#ffb34f')}
    else car.boost=Math.min(100,car.boost+(playerControlled?7:9)*dt);
    car.vx+=Math.cos(car.angle)*accel*dt;car.vy+=Math.sin(car.angle)*accel*dt;
    const friction=Math.pow(playerControlled?.986:.982,dt*60);car.vx*=friction;car.vy*=friction;
    const maxSpeed=(playerControlled?285:220)*(1+(car.mass-1)*.075)*(boostAllowed?1.55:1);const speed=len(car.vx,car.vy);if(speed>maxSpeed){car.vx=car.vx/speed*maxSpeed;car.vy=car.vy/speed*maxSpeed}
    car.x+=car.vx*dt;car.y+=car.vy*dt;
    const edge=car.radius+4;if(car.x<edge){car.x=edge;car.vx=Math.abs(car.vx)*.45}if(car.x>W-edge){car.x=W-edge;car.vx=-Math.abs(car.vx)*.45}if(car.y<edge){car.y=edge;car.vy=Math.abs(car.vy)*.45}if(car.y>H-edge){car.y=H-edge;car.vy=-Math.abs(car.vy)*.45}
  }
  function collideCarBall(car){const dx=ball.x-car.x,dy=ball.y-car.y,d=len(dx,dy),min=car.radius+ball.r;if(d<min){const nx=dx/d,ny=dy/d;const approach=(car.vx-ball.vx)*nx+(car.vy-ball.vy)*ny;const impulse=Math.max(90,approach+145)*(.78+(car.mass-1)*.22);ball.x=car.x+nx*(min+1);ball.y=car.y+ny*(min+1);ball.vx+=nx*impulse+car.vx*.12;ball.vy+=ny*impulse+car.vy*.12;car.vx-=nx*impulse*.12;car.vy-=ny*impulse*.12;car.hit=.12;for(let i=0;i<4;i++)burst(ball.x,ball.y,'#eaffff');if(car.isPlayer)playSound('hit')}}
  function update(dt){if(state!=='playing')return;timeLeft=Math.max(0,timeLeft-dt);const mins=Math.floor(timeLeft/60),secs=Math.floor(timeLeft%60);ui.clock.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    drive(player,dt,true);bots.forEach(c=>drive(c,dt,false));
    for(const c of [player,...bots]){collideCarBall(c);c.hit=Math.max(0,c.hit-dt)}
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.spin+=len(ball.vx,ball.vy)*dt*.018;ball.vx*=Math.pow(.994,dt*60);ball.vy*=Math.pow(.994,dt*60);
    const goalTop=H*.34,goalBottom=H*.66;
    if(ball.y<ball.r+7){ball.y=ball.r+7;ball.vy=Math.abs(ball.vy)*.75}if(ball.y>H-ball.r-7){ball.y=H-ball.r-7;ball.vy=-Math.abs(ball.vy)*.75}
    if(ball.x<ball.r+7){if(ball.y>goalTop&&ball.y<goalBottom){if(ball.x<-15)goal('orange')}else{ball.x=ball.r+7;ball.vx=Math.abs(ball.vx)*.75}}
    if(ball.x>W-ball.r-7){if(ball.y>goalTop&&ball.y<goalBottom){if(ball.x>W+15)goal('blue')}else{ball.x=W-ball.r-7;ball.vx=-Math.abs(ball.vx)*.75}}
    for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];o.phase+=dt*3;for(const c of [player,...bots]){if(Math.hypot(c.x-o.x,c.y-o.y)<c.radius+o.r+2){if(c.isPlayer){c.mass=Math.min(3,c.mass+.08);c.orbs++;updateStats();if(c.orbs%5===0){c.boost=Math.min(100,c.boost+25);ui.boostToast.classList.add('show');clearTimeout(boostNoticeTimer);boostNoticeTimer=setTimeout(()=>ui.boostToast.classList.remove('show'),1000)}playSound('orb')}else c.mass=Math.min(2,c.mass+.025);for(let n=0;n<6;n++)burst(o.x,o.y,c.isPlayer?'#54f4e5':c.team==='orange'?'#ff8759':'#8de6da');orbs.splice(i,1);setTimeout(spawnOrb,1800);break}}}
    particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.98;p.vy*=.98;p.life-=dt}
    if(Math.random()<dt*.55&&orbs.length<40)spawnOrb();if(timeLeft<=0)endMatch();updateStats();
  }
  function roundedRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r)}
  function drawField(){ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#0c252c');bg.addColorStop(.5,'#0a2028');bg.addColorStop(1,'#0b242a');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // turf bands
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'rgba(75,178,157,.018)':'rgba(116,236,205,.035)';ctx.fillRect(i*W/10,0,W/10,H)}
    // luminous pitch markings
    ctx.save();ctx.strokeStyle='rgba(126,213,205,.17)';ctx.lineWidth=2;ctx.setLineDash([]);ctx.strokeRect(34,30,W-68,H-60);ctx.beginPath();ctx.moveTo(W/2,30);ctx.lineTo(W/2,H-30);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,93,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,4,0,Math.PI*2);ctx.fillStyle='#b8e3d8';ctx.fill();
    const boxH=H*.46,boxY=(H-boxH)/2;ctx.strokeRect(34,boxY,120,boxH);ctx.strokeRect(W-154,boxY,120,boxH);ctx.strokeRect(34,boxY+53,48,boxH-106);ctx.strokeRect(W-82,boxY+53,48,boxH-106);
    // side hash marks
    for(let y=57;y<H-40;y+=24){ctx.beginPath();ctx.moveTo(W/2-5,y);ctx.lineTo(W/2+5,y);ctx.stroke()}
    // goals glow and nets
    const gy=H*.34,gh=H*.32;ctx.fillStyle='rgba(60,237,221,.08)';ctx.fillRect(0,gy,35,gh);ctx.fillStyle='rgba(255,132,82,.08)';ctx.fillRect(W-35,gy,35,gh);ctx.strokeStyle='rgba(84,244,229,.5)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(34,gy);ctx.lineTo(0,gy);ctx.lineTo(0,gy+gh);ctx.lineTo(34,gy+gh);ctx.stroke();ctx.strokeStyle='rgba(255,135,89,.54)';ctx.beginPath();ctx.moveTo(W-34,gy);ctx.lineTo(W,gy);ctx.lineTo(W,gy+gh);ctx.lineTo(W-34,gy+gh);ctx.stroke();
    ctx.save();ctx.globalAlpha=.12;ctx.strokeStyle='#8de8de';ctx.lineWidth=1;for(let x=6;x<34;x+=9){ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x,gy+gh);ctx.stroke()}for(let y=gy+8;y<gy+gh;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(34,y);ctx.stroke()}ctx.restore();ctx.restore();
    // perimeter glow
    ctx.strokeStyle='rgba(84,244,229,.2)';ctx.lineWidth=8;ctx.strokeRect(2,2,W-4,H-4);ctx.strokeStyle='rgba(84,244,229,.4)';ctx.lineWidth=1;ctx.strokeRect(7,7,W-14,H-14);
  }
  function drawOrb(o){const pulse=1+Math.sin(o.phase)*.18;ctx.save();ctx.translate(o.x,o.y);ctx.globalAlpha=.35;ctx.fillStyle='#54f4e5';ctx.beginPath();ctx.arc(0,0,o.r*3*pulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#7dfff1';ctx.shadowColor='#54f4e5';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(0,0,o.r*pulse,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#e7fffb';ctx.beginPath();ctx.arc(-o.r*.22,-o.r*.25,o.r*.28,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawCar(c){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);const s=1+(c.mass-1)*.22;ctx.scale(s,s);const color=c.team==='blue'?'#4de9df':'#ff8759';ctx.shadowColor=color;ctx.shadowBlur=c.isPlayer?14:8;
    // boost exhaust
    if((c.isPlayer&&(keys.has(' ')||keys.has('shift')||touch.boost)&&c.boost>0)||(!c.isPlayer&&c.team==='orange'&&c.boost>10)){ctx.fillStyle='#ffb34f';ctx.beginPath();ctx.moveTo(-13,-5);ctx.lineTo(-25-rand(0,9),0);ctx.lineTo(-13,5);ctx.closePath();ctx.fill();ctx.fillStyle='#fff0bb';ctx.beginPath();ctx.moveTo(-13,-2.5);ctx.lineTo(-20,0);ctx.lineTo(-13,2.5);ctx.fill()}
    // wheels
    ctx.shadowBlur=0;ctx.fillStyle='#10171b';roundedRect(ctx,-9,-12,8,5,2);ctx.fill();roundedRect(ctx,4,-12,8,5,2);ctx.fill();roundedRect(ctx,-9,7,8,5,2);ctx.fill();roundedRect(ctx,4,7,8,5,2);ctx.fill();
    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(8,-9);ctx.lineTo(-10,-8);ctx.lineTo(-14,-4);ctx.lineTo(-14,4);ctx.lineTo(-10,8);ctx.lineTo(8,9);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#14232b';ctx.beginPath();ctx.moveTo(5,-6);ctx.lineTo(-5,-5);ctx.lineTo(-9,-2);ctx.lineTo(5,-2);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(5,6);ctx.lineTo(-5,5);ctx.lineTo(-9,2);ctx.lineTo(5,2);ctx.closePath();ctx.fill();ctx.fillStyle='#f7fffc';ctx.fillRect(12,-4,2,2);ctx.fillRect(12,2,2,2);ctx.fillStyle='#ff564b';ctx.fillRect(-13,-4,2,2);ctx.fillRect(-13,2,2,2);
    // roof racing stripe
    ctx.fillStyle=c.isPlayer?'rgba(240,255,255,.62)':'rgba(255,255,255,.38)';ctx.fillRect(-3,-6,5,12);ctx.restore();
    if(c.isPlayer){ctx.fillStyle='#e9ffff';ctx.font='700 9px var(--mono)';ctx.textAlign='center';ctx.fillText('YOU',c.x,c.y-24*s)}
  }
  function drawBall(){ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(ball.spin);ctx.shadowColor='#d9fbff';ctx.shadowBlur=15;const g=ctx.createRadialGradient(-5,-6,2,0,0,ball.r*1.5);g.addColorStop(0,'#ffffff');g.addColorStop(.35,'#d7eff0');g.addColorStop(1,'#748e94');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#627a81';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(0,0,ball.r*.58,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-ball.r,0);ctx.lineTo(ball.r,0);ctx.moveTo(0,-ball.r);ctx.lineTo(0,ball.r);ctx.stroke();ctx.fillStyle='#263d44';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawRadar(){rctx.clearRect(0,0,118,70);rctx.fillStyle='#091a21';rctx.fillRect(0,0,118,70);rctx.strokeStyle='#70969a55';rctx.lineWidth=1;rctx.strokeRect(3,5,112,60);rctx.beginPath();rctx.moveTo(59,5);rctx.lineTo(59,65);rctx.stroke();rctx.fillStyle='#54f4e544';rctx.fillRect(2,27,4,16);rctx.fillStyle='#ff875944';rctx.fillRect(112,27,4,16);for(const o of orbs){rctx.fillStyle='#5af3e8';rctx.fillRect(3+o.x/W*112,5+o.y/H*60,1.5,1.5)}for(const c of [player,...bots]){rctx.fillStyle=c.team==='blue'?'#54f4e5':'#ff8759';rctx.beginPath();rctx.arc(3+c.x/W*112,5+c.y/H*60,c.isPlayer?2.6:2,0,Math.PI*2);rctx.fill()}rctx.fillStyle='#f5ffff';rctx.beginPath();rctx.arc(3+ball.x/W*112,5+ball.y/H*60,2,0,Math.PI*2);rctx.fill()}
  function render(){ctx.save();if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake=Math.max(0,shake-.8)}drawField();for(const o of orbs)drawOrb(o);for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.shadowBlur=0;drawBall();for(const c of bots)drawCar(c);drawCar(player);ctx.restore();drawRadar()}
  function frame(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;if(state==='playing')update(dt);render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
  function togglePause(){if(state==='playing'){state='paused';ui.notice.classList.remove('hidden');ui.notice.querySelector('.notice-kicker').textContent='TAKE A BREATHER';ui.notice.querySelector('h1').innerHTML='MATCH<br><em>PAUSED.</em>';ui.notice.querySelector('p').textContent='Catch your breath. The arena can wait.';ui.notice.querySelector('.primary-btn').innerHTML='RESUME MATCH <span>↗</span>';ui.notice.querySelector('.notice-foot').innerHTML='PRESS <kbd>P</kbd> TO RESUME';ui.status.textContent='PAUSED'}else if(state==='paused'){state='playing';ui.notice.classList.add('hidden');ui.status.textContent='IN PLAY';last=performance.now()}}
  $('playBtn').addEventListener('click',()=>{if(state==='paused'){togglePause();return}if(state==='ended'){resetMatch();ui.notice.querySelector('.notice-kicker').textContent='READY, ROCKET?';ui.notice.querySelector('h1').innerHTML='OWN THE<br><em>ARENA.</em>';ui.notice.querySelector('p').textContent='Collect. Grow. Score.';ui.notice.querySelector('.primary-btn').innerHTML='PLAY MATCH <span>↗</span>';ui.notice.querySelector('.notice-foot').innerHTML='PRESS <kbd>ENTER</kbd> TO START'}startMatch()});
  $('resetBtn').addEventListener('click',()=>{resetMatch();state='menu';ui.status.textContent='KICK OFF';ui.clock.textContent='02:00';ui.notice.querySelector('.notice-kicker').textContent='READY, ROCKET?';ui.notice.querySelector('h1').innerHTML='OWN THE<br><em>ARENA.</em>';ui.notice.querySelector('p').textContent='Collect. Grow. Score.';ui.notice.querySelector('.primary-btn').innerHTML='PLAY MATCH <span>↗</span>';ui.notice.querySelector('.notice-foot').innerHTML='PRESS <kbd>ENTER</kbd> TO START';ui.notice.classList.remove('hidden');announce('MATCH RESET')});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys.add(k);if(k==='enter'&&state!=='playing'){if(state==='paused')togglePause();else $('playBtn').click()}if(k==='p'&&state!=='menu'&&state!=='ended')togglePause()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
  $('soundBtn').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?'♫':'♩';e.currentTarget.style.color=soundOn?'var(--cyan)':'';if(soundOn)playSound('start');announce(soundOn?'SOUND ON':'SOUND OFF')});
  $('helpBtn').addEventListener('click',()=>$('helpModal').classList.add('open'));$('closeHelp').addEventListener('click',()=>$('helpModal').classList.remove('open'));$('gotItBtn').addEventListener('click',()=>$('helpModal').classList.remove('open'));$('helpModal').addEventListener('click',e=>{if(e.target===$('helpModal'))$('helpModal').classList.remove('open')});
  const zone=$('stickZone'),stick=$('stick');function stickMove(e){const rect=zone.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=32,l=Math.hypot(dx,dy)||1,m=Math.min(max,l);touch.x=dx/l*(m/max);touch.y=dy/l*(m/max);stick.style.transform=`translate(${touch.x*32}px,${touch.y*32}px)`;touch.active=true}zone.addEventListener('pointerdown',e=>{zone.setPointerCapture(e.pointerId);stickMove(e)});zone.addEventListener('pointermove',e=>{if(zone.hasPointerCapture(e.pointerId))stickMove(e)});function releaseStick(){touch.active=false;touch.x=touch.y=0;stick.style.transform=''}zone.addEventListener('pointerup',releaseStick);zone.addEventListener('pointercancel',releaseStick);
  const boostBtn=$('boostTouch');boostBtn.addEventListener('pointerdown',e=>{e.preventDefault();touch.boost=true;boostBtn.setPointerCapture(e.pointerId)});boostBtn.addEventListener('pointerup',()=>touch.boost=false);boostBtn.addEventListener('pointercancel',()=>touch.boost=false);boostBtn.addEventListener('lostpointercapture',()=>touch.boost=false);
})();
