/**
 * NEON ARROW: INFINITY
 * Concept: Infinite vector space, sleek neon visuals, persistent economy.
 * "No Box" -> Open Infinite Canvas, clean vector shapes.
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- CONSTANTS ---
const SKINS = {
    'classic': { name: 'V-WING', color: '#0ff', type: 'fighter' },
    'ruby': { name: 'RED SHIFT', color: '#f05', type: 'delta', cost: 200 },
    'gold': { name: 'MIDAS', color: '#fe0', type: 'needle', cost: 500 },
    'void': { name: 'VOID', color: '#fff', type: 'fighter', cost: 1000 },
    'phantom': { name: 'GHOST', color: '#a0f', type: 'stealth', cost: 1500 }
};

// --- STATE ---
let player = { coins: 0, inventory: ['classic'], equipped: 'classic', highScore: 0 };
let game = { active: false, score: 0, sessionCoins: 0, lives: 3, lastTime: 0 };
let camera = { x: 0, y: 0 }; // Virtual camera
let input = { x: 0, y: 0, fire: false, pointerDown: false, px: 0, py: 0 };

let entities = [];
let particles = [];
let bgStars = [];

// --- LOAD/SAVE ---
function loadData() {
    try {
        const d = JSON.parse(localStorage.getItem('neon_arrow_v1'));
        if (d) player = { ...player, ...d };
        updateMenuStats();
    } catch (e) { }
}
function saveData() {
    localStorage.setItem('neon_arrow_v1', JSON.stringify(player));
}

// --- DOM ELEMENTS ---
const ui = {
    start: document.getElementById('start-screen'),
    gameover: document.getElementById('game-over-screen'),
    shop: document.getElementById('shop-screen'),
    score: document.getElementById('score-display'),
    coins: document.getElementById('coin-display'),
    lives: document.getElementById('lives-display'),
    msg: document.getElementById('message-display'),
    shopGrid: document.getElementById('shop-grid'),
    shopCoins: document.getElementById('shop-coins-display'),
    startBtn: document.getElementById('start-btn'),
    shopBtn: document.getElementById('shop-open-btn'),
    shopClose: document.getElementById('shop-close-btn'),
    restartBtn: document.getElementById('restart-btn'),
    shopBtn2: document.getElementById('shop-open-btn-2'),
    menuBtn: document.getElementById('menu-btn'),
    fireBtn: document.getElementById('fire-btn'),
    menuScore: document.getElementById('menu-highscore'),
    menuCoins: document.getElementById('menu-coins'),
    finalScore: document.getElementById('final-score'),
    finalCoins: document.getElementById('final-coins')
};

// --- INIT ---
function init() {
    loadData();
    resize();
    initStars();
    renderShop();

    // Listeners
    window.addEventListener('resize', resize);
    ui.startBtn.onclick = startGame;
    ui.restartBtn.onclick = startGame;
    ui.shopBtn.onclick = openShop;
    ui.shopBtn2.onclick = openShop;
    ui.shopClose.onclick = closeShop;
    ui.menuBtn.onclick = goToMenu;

    // Input
    window.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' || e.key === 'w') input.y = -1;
        if (e.key === 'ArrowDown' || e.key === 's') input.y = 1;
        if (e.key === 'ArrowLeft' || e.key === 'a') input.x = -1;
        if (e.key === 'ArrowRight' || e.key === 'd') input.x = 1;
        if (e.code === 'Space') input.fire = true;
    });
    window.addEventListener('keyup', e => {
        if ((e.key === 'ArrowUp' || e.key === 'w') && input.y < 0) input.y = 0;
        if ((e.key === 'ArrowDown' || e.key === 's') && input.y > 0) input.y = 0;
        if ((e.key === 'ArrowLeft' || e.key === 'a') && input.x < 0) input.x = 0;
        if ((e.key === 'ArrowRight' || e.key === 'd') && input.x > 0) input.x = 0;
        if (e.code === 'Space') input.fire = false;
    });

    // Touch
    const handleMove = (x, y) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > 20) {
            const a = Math.atan2(y - cy, x - cx);
            input.x = Math.cos(a);
            input.y = Math.sin(a);
        } else {
            input.x = 0; input.y = 0;
        }
    };

    document.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        input.pointerDown = true;
        handleMove(e.clientX, e.clientY);
    });
    document.addEventListener('pointermove', e => {
        if (input.pointerDown) handleMove(e.clientX, e.clientY);
    });
    document.addEventListener('pointerup', () => {
        input.pointerDown = false; input.x = 0; input.y = 0;
    });

    ui.fireBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); input.fire = true; });
    ui.fireBtn.addEventListener('touchend', e => { e.preventDefault(); input.fire = false; });
    ui.fireBtn.addEventListener('mousedown', e => { input.fire = true; });
    ui.fireBtn.addEventListener('mouseup', e => { input.fire = false; });

    requestAnimationFrame(loop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initStars() {
    bgStars = [];
    for (let i = 0; i < 100; i++) {
        bgStars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            z: Math.random() * 2 + 0.5 // Depth/Speed
        });
    }
}

// --- GAME LOGIC ---

function startGame() {
    game.active = true;
    game.score = 0;
    game.sessionCoins = 0;
    game.lives = 3;
    game.lastTime = performance.now();

    entities = [];
    particles = [];

    // Player Entity
    entities.push({
        id: 'player', type: 'player',
        x: 0, y: 0, angle: -Math.PI / 2,
        vx: 0, vy: 0, speed: 350,
        radius: 12, color: SKINS[player.equipped].color,
        cooldown: 0
    });

    ui.start.classList.remove('active');
    ui.gameover.classList.remove('active');
    ui.shop.classList.remove('active');
    updateHUD();
}

function spawnLogic(dt) {
    if (!game.active) return;

    const playerEnt = entities.find(e => e.type === 'player');
    if (!playerEnt) return;

    // Helper: Spawn distance
    const getPos = (minDist = 600, maxDist = 1000) => {
        const a = Math.random() * Math.PI * 2;
        const d = minDist + Math.random() * (maxDist - minDist);
        return { x: playerEnt.x + Math.cos(a) * d, y: playerEnt.y + Math.sin(a) * d };
    };

    // Targets
    const targets = entities.filter(e => e.type === 'target');
    if (targets.length < 5 && Math.random() < 0.05) {
        const p = getPos();
        entities.push({
            type: 'target', x: p.x, y: p.y,
            vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
            radius: 15, color: '#0f0', angle: 0, rotSpeed: Math.random() - 0.5
        });
    }

    // Coins (Visual: Diamond shape)
    const coins = entities.filter(e => e.type === 'coin');
    if (coins.length < 3 && Math.random() < 0.02) {
        const p = getPos();
        entities.push({
            type: 'coin', x: p.x, y: p.y,
            vx: 0, vy: 0, radius: 10, color: '#ff0'
        });
    }

    // Enemies
    const enemies = entities.filter(e => e.type === 'enemy');
    const threatLevel = 2 + Math.floor(game.score / 500);
    if (enemies.length < threatLevel && Math.random() < 0.03) {
        const p = getPos(800, 1200);
        const type = Math.random() < 0.3 ? 'shooter' : 'chaser';
        entities.push({
            type: 'enemy', behavior: type,
            x: p.x, y: p.y, radius: 15,
            color: type === 'shooter' ? '#f0f' : '#f00',
            hp: type === 'shooter' ? 2 : 1,
            cooldown: 0
        });
    }
}

function update(dt) {
    if (!game.active) {
        // Menu animation?
        return;
    }

    const pEnt = entities.find(e => e.type === 'player');
    if (!pEnt) return;

    // 1. Player Movement (Smooth Vector)
    if (input.x !== 0 || input.y !== 0) {
        const targetAngle = Math.atan2(input.y, input.x);
        let diff = targetAngle - pEnt.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        pEnt.angle += diff * 8 * dt;

        // Thrust
        pEnt.x += Math.cos(pEnt.angle) * pEnt.speed * dt;
        pEnt.y += Math.sin(pEnt.angle) * pEnt.speed * dt;

        // Trail
        if (Math.random() < 0.5) spawnParticle(pEnt.x, pEnt.y, pEnt.color, -Math.cos(pEnt.angle) * 50, -Math.sin(pEnt.angle) * 50);
    }

    // 2. Camera Follow
    const lerp = 5 * dt;
    camera.x += (pEnt.x - camera.x) * lerp;
    camera.y += (pEnt.y - camera.y) * lerp;

    // 3. Shooting
    pEnt.cooldown -= dt;
    if (input.fire && pEnt.cooldown <= 0) {
        pEnt.cooldown = 0.2;
        const tipX = pEnt.x + Math.cos(pEnt.angle) * 20;
        const tipY = pEnt.y + Math.sin(pEnt.angle) * 20;
        entities.push({
            type: 'bullet', source: 'player',
            x: tipX, y: tipY,
            vx: Math.cos(pEnt.angle) * 800, vy: Math.sin(pEnt.angle) * 800,
            radius: 3, color: '#fff', life: 2
        });
        spawnParticle(tipX, tipY, '#fff', 0, 0, 10);
    }

    // 4. Entity Loop
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (e.type === 'player') continue;

        // Move
        if (e.vx) e.x += e.vx * dt;
        if (e.vy) e.y += e.vy * dt;

        // Cleanup distance
        if (Math.hypot(e.x - camera.x, e.y - camera.y) > 2000) {
            entities.splice(i, 1); continue;
        }

        // Logic
        if (e.type === 'bullet') {
            e.life -= dt;
            if (e.life <= 0) { entities.splice(i, 1); continue; }

            // Hit check
            if (e.source === 'player') {
                const hits = entities.filter(t => (t.type === 'enemy' || t.type === 'target') && Math.hypot(t.x - e.x, t.y - e.y) < t.radius + e.radius);
                if (hits.length > 0) {
                    hits.forEach(h => {
                        // Kill logic
                        if (h.type === 'target') {
                            destroyEntity(h);
                            addScore(50);
                        } else if (h.type === 'enemy') {
                            h.hp--;
                            if (h.hp <= 0) {
                                destroyEntity(h);
                                addScore(100);
                            } else {
                                spawnParticle(h.x, h.y, '#fff', 0, 0, 5); // hit effect
                            }
                        }
                    });
                    entities.splice(i, 1); // Kill Bullet
                    continue;
                }
            } else {
                // Enemy bullet
                if (Math.hypot(pEnt.x - e.x, pEnt.y - e.y) < pEnt.radius + e.radius) {
                    entities.splice(i, 1);
                    damagePlayer();
                    continue;
                }
            }
        }

        else if (e.type === 'target') {
            e.angle += e.rotSpeed * dt;
            if (Math.hypot(pEnt.x - e.x, pEnt.y - e.y) < pEnt.radius + e.radius) {
                destroyEntity(e);
                entities.splice(entities.indexOf(e), 1);
                addScore(100);
            }
        }

        else if (e.type === 'coin') {
            if (Math.hypot(pEnt.x - e.x, pEnt.y - e.y) < pEnt.radius + e.radius + 10) { // Magnet feel
                entities.splice(i, 1);
                game.sessionCoins++;
                showMsg("+1 💎");
                updateHUD();
                spawnParticle(e.x, e.y, '#ff0', 0, 0, 20);
            }
        }

        else if (e.type === 'enemy') {
            // Chase
            const dx = pEnt.x - e.x;
            const dy = pEnt.y - e.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            if (e.behavior === 'shooter') {
                // Keep distance
                if (dist > 300) {
                    e.x += Math.cos(angle) * 150 * dt;
                    e.y += Math.sin(angle) * 150 * dt;
                }
                // Shoot
                e.cooldown -= dt;
                if (e.cooldown <= 0 && dist < 600) {
                    e.cooldown = 2;
                    entities.push({
                        type: 'bullet', source: 'enemy',
                        x: e.x, y: e.y,
                        vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
                        radius: 4, color: '#f0f', life: 3
                    });
                }
            } else {
                // Ram
                e.x += Math.cos(angle) * 200 * dt;
                e.y += Math.sin(angle) * 200 * dt;
            }

            if (dist < e.radius + pEnt.radius) {
                destroyEntity(e);
                entities.splice(i, 1);
                damagePlayer();
            }
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    spawnLogic(dt);
}

// --- RENDER ---

function draw() {
    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Starfield Parallax
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    // We want stars to move opposite to camera
    ctx.fillStyle = '#fff';
    bgStars.forEach(s => {
        // Infinite scrolling wrap
        let sx = (s.x - camera.x * s.z * 0.1) % canvas.width;
        let sy = (s.y - camera.y * s.z * 0.1) % canvas.height;
        if (sx < 0) sx += canvas.width;
        if (sy < 0) sy += canvas.height;

        ctx.globalAlpha = Math.random() * 0.5 + 0.3;
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, s.z), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Game World Transform
    ctx.save();
    ctx.translate(cx, cy);
    ctx.translate(-camera.x, -camera.y);

    // Draw Entities
    entities.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);

        if (e.type === 'player') {
            ctx.rotate(e.angle);
            ctx.shadowBlur = 20; ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            // Vector Shape: Fighter
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, 10);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-10, -10);
            ctx.closePath();
            ctx.fill();
        }
        else if (e.type === 'target') {
            ctx.rotate(e.angle);
            ctx.strokeStyle = e.color; ctx.lineWidth = 3;
            ctx.shadowBlur = 10; ctx.shadowColor = e.color;
            ctx.strokeRect(-10, -10, 20, 20); // Square target
            // Inner
            ctx.fillStyle = e.color; ctx.globalAlpha = 0.3;
            ctx.fillRect(-10, -10, 20, 20);
        }
        else if (e.type === 'coin') {
            ctx.fillStyle = e.color; ctx.shadowBlur = 15; ctx.shadowColor = e.color;
            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0);
            ctx.fill();
        }
        else if (e.type === 'enemy') {
            ctx.fillStyle = e.color; ctx.shadowBlur = 10; ctx.shadowColor = e.color;
            ctx.beginPath();
            // Spiky ball
            for (let i = 0; i < 8; i++) {
                const rot = (Math.PI * 2 / 8) * i;
                const r = i % 2 === 0 ? e.radius : e.radius * 0.5;
                ctx.lineTo(Math.cos(rot) * r, Math.sin(rot) * r);
            }
            ctx.fill();
        }
        else if (e.type === 'bullet') {
            ctx.fillStyle = e.color; ctx.shadowBlur = 5; ctx.shadowColor = e.color;
            ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    });

    // Particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();
}

function loop(now) {
    const dt = Math.min((now - game.lastTime) / 1000, 0.1);
    game.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

// --- HELPERS ---

function destroyEntity(e) {
    spawnParticle(e.x, e.y, e.color, 0, 0, 15, 100);
}

function spawnParticle(x, y, color, vxBase = 0, vyBase = 0, count = 1, speed = 50) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed;
        particles.push({
            x: x, y: y,
            vx: vxBase + Math.cos(a) * s,
            vy: vyBase + Math.sin(a) * s,
            life: 0.5 + Math.random() * 0.5,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

function addScore(amt) {
    game.score += amt;
    updateHUD();
}

function showMsg(txt) {
    ui.msg.innerText = txt;
    ui.msg.classList.add('visible');
    setTimeout(() => ui.msg.classList.remove('visible'), 1000);
}

function damagePlayer() {
    game.lives--;
    updateHUD();
    // Shake
    const mag = 10;
    camera.x += (Math.random() - 0.5) * mag;
    camera.y += (Math.random() - 0.5) * mag;

    if (game.lives <= 0) gameOver();
}

function gameOver() {
    game.active = false;
    player.coins += game.sessionCoins;
    if (game.score > player.highScore) player.highScore = game.score;
    saveData();

    ui.finalScore.innerText = game.score;
    ui.finalCoins.innerText = game.sessionCoins;
    updateMenuStats();
    ui.gameover.classList.add('active');
}

function updateHUD() {
    ui.score.innerText = game.score;
    ui.coins.innerText = player.coins + game.sessionCoins;
    ui.lives.innerText = '❤️'.repeat(game.lives);
}

function updateMenuStats() {
    ui.menuScore.innerText = player.highScore;
    ui.menuCoins.innerText = player.coins;
}

// --- SHOP LOGIC ---
function renderShop() {
    ui.shopCoins.innerText = player.coins;
    ui.shopGrid.innerHTML = '';

    Object.keys(SKINS).forEach(k => {
        const item = SKINS[k];
        const owned = player.inventory.includes(k);
        const equipped = player.equipped === k;

        const el = document.createElement('div');
        el.className = `shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`;

        let btn = (equipped)
            ? `<button class="action-btn btn-active">EQUIPPED</button>`
            : (owned
                ? `<button class="action-btn btn-equip" onclick="doEquip('${k}')">EQUIP</button>`
                : `<button class="action-btn btn-buy" onclick="doBuy('${k}')">BUY ${item.cost || 0}</button>`
            );

        el.innerHTML = `
            <div class="item-visual"><div class="visual-circle" style="color:${item.color}; background:${item.color}"></div></div>
            <div class="item-name">${item.name}</div>
            ${btn}
        `;
        ui.shopGrid.appendChild(el);
    });
}

function openShop() { ui.shop.classList.add('active'); renderShop(); }
function closeShop() { ui.shop.classList.remove('active'); }

window.doBuy = (k) => {
    const cost = SKINS[k].cost || 0;
    if (player.coins >= cost) {
        player.coins -= cost;
        player.inventory.push(k);
        saveData(); renderShop(); updateMenuStats();
    }
}
window.doEquip = (k) => {
    player.equipped = k;
    saveData(); renderShop();
}

function goToMenu() {
    ui.gameover.classList.remove('active');
    ui.start.classList.add('active');
    updateMenuStats();
}

// Start
init();
