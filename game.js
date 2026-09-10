const CONFIG = {
  // Paste your deployed Google Apps Script Web App URL here.
  // Example: https://script.google.com/macros/s/XXXX/exec
  SHEETS_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE"
};

const $ = id => document.getElementById(id);
const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
let W=innerWidth,H=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener("resize",resize); resize();

let player, enemies=[], bullets=[], enemyBullets=[], particles=[], trees=[], score=0,kills=0,level=1,running=false;
let keys={}, mouse={x:W/2,y:H/2,down:false}, aim={x:1,y:0}, last=0, spawnTimer=0, levelKills=0, cheat=false;
let username="";

const loginScreen=$("loginScreen"),gameScreen=$("gameScreen");
$("loginForm").addEventListener("submit",e=>{e.preventDefault();username=$("username").value.trim();const pass=$("password").value;if(!username||!pass)return;$("loginMsg").textContent="";startGame();});
$("retryBtn").onclick=()=>{startGame()};
$("menuBtn").onclick=()=>{running=false;$("gameOver").classList.add("hidden");gameScreen.classList.add("hidden");loginScreen.classList.remove("hidden");loadLeaderboard()};
$("winMenuBtn").onclick=async()=>{await saveScore();running=false;$("winScreen").classList.add("hidden");gameScreen.classList.add("hidden");loginScreen.classList.remove("hidden");loadLeaderboard()};
$("cheatOpen").onclick=()=>{$("cheatPanel").classList.remove("hidden");$("cheatCode").focus()};
$("cheatClose").onclick=()=>{$("cheatPanel").classList.add("hidden")};
$("cheatSubmit").onclick=()=>{if($("cheatCode").value==="SUKILIAR"){cheat=true;player.maxHp=1000;player.hp=1000;$("cheatMsg").textContent="CHEAT AKTIF! HP 1000 & damage 3×";$("cheatMsg").style.color="#63ff9b"}else{$("cheatMsg").textContent="Kode salah.";$("cheatMsg").style.color="#ff7070"}};

function loadLeaderboard(){
  const box=$("leaderboardLogin");
  if(!CONFIG.SHEETS_URL || CONFIG.SHEETS_URL.includes("PASTE_")){box.innerHTML='<div class="small">Hubungkan Google Sheets untuk menampilkan leaderboard.</div>';return}
  fetch(CONFIG.SHEETS_URL).then(r=>r.json()).then(data=>renderLB(box,data)).catch(()=>box.innerHTML='<div class="small">Leaderboard belum tersedia.</div>');
}
function renderLB(box,data){
  const rows=(Array.isArray(data)?data:[]).slice(0,10);
  if(!rows.length){box.innerHTML='<div class="small">Belum ada skor.</div>';return}
  box.innerHTML=rows.map((r,i)=>`<div class="lb-row"><b>#${i+1}</b><span>${esc(r.username||"Player")}</span><strong>${Number(r.score||0)}</strong></div>`).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function saveScore(){
  if(!CONFIG.SHEETS_URL || CONFIG.SHEETS_URL.includes("PASTE_"))return;
  try{await fetch(CONFIG.SHEETS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({username,score,level,kills,date:new Date().toISOString()})})}catch(e){}
}

function startGame(){
  loginScreen.classList.add("hidden");gameScreen.classList.remove("hidden");
  score=0;kills=0;level=1;levelKills=0;cheat=false;bullets=[];enemyBullets=[];enemies=[];particles=[];trees=[];spawnTimer=0;
  player={x:W/2,y:H/2,r:16,hp:100,maxHp:100,speed:220,fireCd:0,angle:0};
  for(let i=0;i<45;i++)trees.push({x:Math.random()*W,y:Math.random()*H,r:16+Math.random()*18});
  for(let i=0;i<4;i++)spawnEnemy();
  $("gameOver").classList.add("hidden");$("winScreen").classList.add("hidden");running=true;last=performance.now();requestAnimationFrame(loop);
}

function weapon(){
  if(level<10)return"Pistol";
  if(level<25)return level>=20?"Shotgun+": "Shotgun";
  return"AK-47";
}
function playerDamage(){return cheat?30:10}
function enemyDamage(){return level<=10?10:level<=20?20:30}
function updateHUD(){
  $("level").textContent=level;$("weapon").textContent=weapon();$("kills").textContent=kills;$("score").textContent=score;
  $("hpText").textContent=`${Math.max(0,Math.ceil(player.hp))} / ${player.maxHp}`;$("hpBar").style.width=Math.max(0,player.hp/player.maxHp*100)+"%";
}

function spawnEnemy(){
  const side=Math.floor(Math.random()*4), pad=30;
  let x=side===0?-pad:side===1?W+pad:Math.random()*W,y=side===2?-pad:side===3?H+pad:Math.random()*H;
  const shapes=["circle","square","triangle"],shape=shapes[Math.floor(Math.random()*3)];
  enemies.push({x,y,r:14+Math.random()*10,shape,hp:30+level*7,maxHp:30+level*7,speed:45+level*2.2,shoot:1+Math.random()*1.5,phase:Math.random()*6.28});
}
function shootEnemy(e,dt){
  e.shoot-=dt;if(e.shoot>0)return;
  e.shoot=level<6?1.6:level<11?1.25:level<16?1.0:level<21?.85:.72;
  const dx=player.x-e.x,dy=player.y-e.y,a=Math.atan2(dy,dx);
  if(level<=5){enemyShot(e,a)}
  else if(level<=10){for(let j=-1;j<=1;j++)enemyShot(e,a+j*.16)}
  else if(level<=15){for(let j=-2;j<=2;j++)enemyShot(e,a+j*.22)}
  else if(level<=20){enemyShot(e,a);enemyShot(e,a+.35);enemyShot(e,a-.35)}
  else if(level<=25){for(let j=0;j<10;j++)enemyShot(e,j*Math.PI*2/10+e.phase)}
  else{for(let j=0;j<5;j++)enemyShot(e,e.phase+j*Math.PI*2/5)}
}
function enemyShot(e,a){enemyBullets.push({x:e.x+Math.cos(a)*e.r,y:e.y+Math.sin(a)*e.r,vx:Math.cos(a)*(110+level*4),vy:Math.sin(a)*(110+level*4),r:5,life:5})}

function fire(){
  if(!running||player.fireCd>0)return;
  const a=player.angle;
  if(level<10){bullet(a,520,7,1)}
  else if(level<25){for(let j=-2;j<=2;j++)bullet(a+j*.12,470,6,1.5)}
  else{for(let j=-1;j<=1;j++)bullet(a+j*.055,650,5,1)}
  player.fireCd=level<10?.22:level<20?.48:level<25?.35:.08;
}
function bullet(a,speed,r,life){bullets.push({x:player.x+Math.cos(a)*20,y:player.y+Math.sin(a)*20,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r,life,damage:playerDamage()})}

addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.code==="Space"){e.preventDefault();fire()}});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener("mousemove",e=>{mouse.x=e.clientX;mouse.y=e.clientY;player&&(player.angle=Math.atan2(mouse.y-player.y,mouse.x-player.x))});
canvas.addEventListener("mousedown",()=>{mouse.down=true;fire()});addEventListener("mouseup",()=>mouse.down=false);
canvas.addEventListener("touchstart",e=>{if(e.touches.length){const t=e.touches[0];mouse.x=t.clientX;mouse.y=t.clientY;player.angle=Math.atan2(mouse.y-player.y,mouse.x-player.x);fire()}},{passive:false});
canvas.addEventListener("touchmove",e=>{if(e.touches.length){const t=e.touches[0];mouse.x=t.clientX;mouse.y=t.clientY;player.angle=Math.atan2(mouse.y-player.y,mouse.x-player.x)}},{passive:false});

const joy=$("joystick"),stick=$("stick"),fireBtn=$("fireBtn");let joyId=null;
joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);moveJoy(e)});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)moveJoy(e)});
joy.addEventListener("pointerup",()=>{joyId=null;stick.style.transform="translate(0,0)";aim.x=aim.y=0});
function moveJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=39;if(len>max){dx=dx/len*max;dy=dy/len*max}stick.style.transform=`translate(${dx}px,${dy}px)`;aim.x=dx/max;aim.y=dy/max}
fireBtn.addEventListener("pointerdown",e=>{e.preventDefault();fire();fireBtn.setPointerCapture(e.pointerId)});

function update(dt){
  if(!running)return;
  let mx=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0),my=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
  if(aim.x||aim.y){mx=aim.x;my=aim.y}
  const len=Math.hypot(mx,my)||1;player.x+=mx/len*player.speed*dt;player.y+=my/len*player.speed*dt;
  player.x=Math.max(20,Math.min(W-20,player.x));player.y=Math.max(20,Math.min(H-20,player.y));
  if(mouse.down)fire();player.fireCd=Math.max(0,player.fireCd-dt);
  spawnTimer-=dt;if(spawnTimer<=0){spawnTimer=Math.max(.25,1.15-level*.02);spawnEnemy()}
  for(const e of enemies){const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt;shootEnemy(e,dt);if(d<e.r+player.r){player.hp-=enemyDamage()*dt}}
  for(let i=bullets.length-1;i>=0;i--){let b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<-30||b.x>W+30||b.y<-30||b.y>H+30){bullets.splice(i,1);continue}
    for(let j=enemies.length-1;j>=0;j--){let e=enemies[j];if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){e.hp-=b.damage;burst(b.x,b.y);bullets.splice(i,1);if(e.hp<=0){score+=10+level*5;kills++;levelKills++;burst(e.x,e.y,12);enemies.splice(j,1);if(levelKills>=8&&level<30){level++;levelKills=0}if(level===30&&kills>=Math.max(80,level*2)){running=false;$("winScore").textContent=score;$("winScreen").classList.remove("hidden");saveScore()} }break}}
  }
  for(let i=enemyBullets.length-1;i>=0;i--){let b=enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<-50||b.x>W+50||b.y<-50||b.y>H+50){enemyBullets.splice(i,1);continue}if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r){player.hp-=enemyDamage();enemyBullets.splice(i,1);burst(player.x,player.y,4)}}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
  if(player.hp<=0){player.hp=0;running=false;$("finalLevel").textContent=level;$("finalScore").textContent=score;$("gameOver").classList.remove("hidden");saveScore()}
  updateHUD();
}
function burst(x,y,n=5){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*90;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.35,r:2+Math.random()*3})}}

function draw(){
  ctx.clearRect(0,0,W,H);
  // forest
  ctx.fillStyle="#173a20";ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#1d4927";for(let x=0;x<W;x+=55)for(let y=0;y<H;y+=55){ctx.beginPath();ctx.arc(x+((y/55)%2)*20,y,2,0,7);ctx.fill()}
  for(const t of trees){ctx.fillStyle="#573a22";ctx.fillRect(t.x-5,t.y,t.r*.35,t.r*1.5);ctx.fillStyle="#245c2d";ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,7);ctx.fill();ctx.fillStyle="#2f7338";ctx.beginPath();ctx.arc(t.x-7,t.y-7,t.r*.65,0,7);ctx.fill()}
  for(const b of enemyBullets){ctx.fillStyle="#ff4545";ctx.shadowBlur=12;ctx.shadowColor="#ff2222";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();ctx.shadowBlur=0}
  for(const b of bullets){ctx.fillStyle="#bde9ff";ctx.shadowBlur=10;ctx.shadowColor="#42aaff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();ctx.shadowBlur=0}
  for(const e of enemies){drawEnemy(e)}
  // player glow
  ctx.save();ctx.shadowBlur=28;ctx.shadowColor="#1598ff";ctx.fillStyle="#299cff";ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,7);ctx.fill();ctx.restore();
  ctx.strokeStyle="#d8f2ff";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x+Math.cos(player.angle)*27,player.y+Math.sin(player.angle)*27);ctx.stroke();
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.7);ctx.fillStyle="#ff6262";ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();ctx.globalAlpha=1}
}
function drawEnemy(e){ctx.save();ctx.fillStyle="#e52d38";ctx.shadowBlur=14;ctx.shadowColor="#ff2020";ctx.translate(e.x,e.y);if(e.shape==="circle"){ctx.beginPath();ctx.arc(0,0,e.r,0,7);ctx.fill()}else if(e.shape==="square"){ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2)}else{ctx.beginPath();ctx.moveTo(0,-e.r);ctx.lineTo(e.r,e.r);ctx.lineTo(-e.r,e.r);ctx.closePath();ctx.fill()}ctx.restore();ctx.fillStyle="#24090b";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2,3);ctx.fillStyle="#66ef6b";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2*Math.max(0,e.hp/e.maxHp),3)}

function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();if(running)requestAnimationFrame(loop)}
loadLeaderboard();
