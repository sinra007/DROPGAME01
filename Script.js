const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const multiplierElement = document.getElementById('multiplier');
const finalScoreElement = document.getElementById('final-score');
const finalLevelElement = document.getElementById('final-level');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const movementArea = document.getElementById('movement-area');
const movementIndicator = document.getElementById('movement-indicator');
const shootBtn = document.getElementById('shoot-btn');
const controlsArea = document.getElementById('controls-area');
const gameContainer = document.getElementById('game-container');

const starCanvas = document.createElement('canvas');
const starCtx = starCanvas.getContext('2d');

let gameRunning = false;
let isPaused = false;
let score = 0;
let level = 1;
let multiplier = 1;
let multiplierActive = false;
let multiplierTimeout;
let gameSpeed = 2;
let stones = [];
let projectiles = [];
let particlePool = [];
let lastStoneSpawn = 0;
let stoneSpawnRate = 1000; // ms
let lastLevelIncrease = 0;
let levelIncreaseInterval = 30000; // ms
let lastFrameTime = 0;
let lastFpsTime = 0;
let frameCount = 0;

// Touch state
let isMoving = false;
let touchStartX = 0;
let currentTouchX = 0;

// Keyboard state
let leftPressed = false;
let rightPressed = false;

// Mouse state
let mouseX = 0;

// Detect touch device
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (!isTouchDevice) {
    controlsArea.style.display = 'none';
    canvas.height = gameContainer.clientHeight;
}

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height - 60,
    width: 60,
    height: 30,
    speed: 12,
    color: '#00ccff',
    shootCooldown: 0,
    shootDelay: 300 // ms
};

// Stone types
const stoneTypes = [
    { name: 'Quartz', color: ['#ffffff', '#cccccc'], points: 1, radius: 20, weight: 1.0 },
    { name: 'Obsidian', color: ['#000000', '#333333'], points: 2, radius: 25, weight: 1.2 },
    { name: 'Jade', color: ['#00cc66', '#00994d'], points: 3, radius: 22, weight: 0.9 },
    { name: 'Amethyst', color: ['#cc00ff', '#9900cc'], points: 5, radius: 30, weight: 0.8 },
    { name: 'Diamond', color: ['#ffcc00', '#ff9900'], points: 100, radius: 35, weight: 0.6 }
];

const maxParticles = 200;

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = isTouchDevice ? container.clientHeight * 0.8 : container.clientHeight;
    starCanvas.width = canvas.width;
    starCanvas.height = canvas.height;
    initStars();
    player.y = canvas.height - 60;
}

function initStars() {
    starCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    starCtx.shadowBlur = 5;
    starCtx.shadowColor = '#ffffff';
    for (let i = 0; i < 100; i++) {
        const x = (i * 23) % canvas.width;
        const y = (i * 17) % canvas.height;
        const size = Math.random() * 1.5;
        starCtx.beginPath();
        starCtx.arc(x, y, size, 0, Math.PI * 2);
        starCtx.fill();
    }
    starCtx.shadowBlur = 0;
}

function init() {
    resizeCanvas();
    stones = [];
    projectiles = [];
    particlePool = [];
    score = 0;
    level = 1;
    gameSpeed = 2;
    multiplier = 1;
    multiplierActive = false;
    player.x = canvas.width / 2;
    player.y = canvas.height - 60;
    updateUI();
}

function updateUI() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    multiplierElement.textContent = `x${multiplier}`;
    
    if (multiplierActive) {
        multiplierElement.style.opacity = '1';
        multiplierElement.style.color = '#ffcc00';
    } else {
        multiplierElement.style.opacity = '0.7';
        multiplierElement.style.color = '#4dccff';
    }
}

function drawPlayer() {
    ctx.save();
    
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x - player.width/2, player.y + player.height);
    ctx.lineTo(player.x + player.width/2, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 10);
    ctx.lineTo(player.x - 15, player.y);
    ctx.lineTo(player.x + 15, player.y);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = 'rgba(0, 204, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function createStone() {
    const type = Math.random() < 0.8 ? 
        stoneTypes[Math.floor(Math.random() * 3)] : 
        (Math.random() < 0.8 ? stoneTypes[3] : stoneTypes[4]);
    
    const stone = {
        x: Math.random() * (canvas.width - 100) + 50,
        y: -50,
        radius: type.radius,
        type: type,
        speed: gameSpeed * type.weight,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        active: true
    };
    
    stones.push(stone);
}

function drawStone(stone) {
    if (!stone.active) return;
    ctx.save();
    ctx.translate(stone.x, stone.y);
    ctx.rotate(stone.rotation);
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = stone.type.color[0];
    
    const gradient = ctx.createRadialGradient(
        0, 0, stone.radius * 0.3,
        0, 0, stone.radius
    );
    gradient.addColorStop(0, stone.type.color[0]);
    gradient.addColorStop(1, stone.type.color[1]);
    
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI / 6) + Math.PI / 6;
        const x = Math.cos(angle) * stone.radius;
        const y = Math.sin(angle) * stone.radius;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fill();
    
    if (stone.type.points >= 5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(-stone.radius * 0.2, -stone.radius * 0.2, stone.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function createProjectile() {
    if (player.shootCooldown <= 0) {
        projectiles.push({
            x: player.x,
            y: player.y - 15,
            radius: 6,
            speed: 12,
            color: '#00ccff',
            active: true
        });
        player.shootCooldown = player.shootDelay;
        
        for (let i = 0; i < 5; i++) {
            createParticle(
                player.x,
                player.y,
                '#00ccff',
                (Math.random() - 0.5) * 4,
                -Math.random() * 6,
                30,
                Math.random() * 3 + 1
            );
        }
    }
}

function drawProjectile(projectile) {
    if (!projectile.active) return;
    ctx.save();
    
    ctx.shadowBlur = 10;
    ctx.shadowColor = projectile.color;
    
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
    
    for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.5) {
            createParticle(
                projectile.x,
                projectile.y,
                projectile.color,
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                20,
                Math.random() * 2 + 1
            );
        }
    }
    
    ctx.restore();
}

function createParticle(x, y, color, speedX, speedY, life, radius) {
    const activeParticles = particlePool.filter(p => p.active).length;
    if (activeParticles >= maxParticles) return;
    
    let particle = particlePool.find(p => !p.active);
    if (!particle) {
        particle = {};
        particlePool.push(particle);
    }
    particle.x = x;
    particle.y = y;
    particle.radius = radius;
    particle.color = color;
    particle.speedX = speedX;
    particle.speedY = speedY;
    particle.life = life;
    particle.active = true;
}

function drawParticles() {
    ctx.save();
    particlePool.forEach(particle => {
        if (!particle.active) return;
        ctx.globalAlpha = particle.life / 50;
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function checkCollision(projectile, stone) {
    const dx = projectile.x - stone.x;
    const dy = projectile.y - stone.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < projectile.radius + stone.radius;
}

function activateMultiplier() {
    multiplier = 5;
    multiplierActive = true;
    multiplierElement.style.opacity = '1';
    multiplierElement.style.color = '#ffcc00';
    
    if (multiplierTimeout) {
        clearTimeout(multiplierTimeout);
    }
    
    multiplierTimeout = setTimeout(() => {
        multiplier = 1;
        multiplierActive = false;
        multiplierElement.style.color = '#4dccff';
    }, 5000);
}

function createExplosion(x, y, color, count) {
    const activeParticles = particlePool.filter(p => p.active).length;
    count = Math.min(count, maxParticles - activeParticles);
    for (let i = 0; i < count; i++) {
        createParticle(
            x,
            y,
            color,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            Math.random() * 30 + 20,
            Math.random() * 4 + 2
        );
    }
}

function updateGame(deltaTime) {
    frameCount++;
    if (Date.now() - lastFpsTime >= 1000) {
        console.log(`FPS: ${frameCount}`);
        frameCount = 0;
        lastFpsTime = Date.now();
    }
    
    // Update player position
    if (isTouchDevice) {
        if (isMoving) {
            const movementAreaRect = movementArea.getBoundingClientRect();
            const relativeX = (currentTouchX - movementAreaRect.left) / movementAreaRect.width;
            const targetX = relativeX * canvas.width;
            player.x += (targetX - player.x) * 0.2 * (deltaTime / 16);
            player.x = Math.max(player.width/2, Math.min(canvas.width - player.width/2, player.x));
        }
    } else {
        // Keyboard movement
        if (leftPressed) {
            player.x = Math.max(player.width/2, player.x - player.speed * (deltaTime / 16));
        }
        if (rightPressed) {
            player.x = Math.min(canvas.width - player.width/2, player.x + player.speed * (deltaTime / 16));
        }
        // Mouse movement
        const rect = canvas.getBoundingClientRect();
        const targetX = mouseX - rect.left;
        player.x += (targetX - player.x) * 0.2 * (deltaTime / 16);
        player.x = Math.max(player.width/2, Math.min(canvas.width - player.width/2, player.x));
    }
    
    if (Date.now() - lastStoneSpawn > stoneSpawnRate) {
        createStone();
        lastStoneSpawn = Date.now();
    }
    
    if (Date.now() - lastLevelIncrease > levelIncreaseInterval) {
        level++;
        gameSpeed += 0.5;
        stoneSpawnRate = Math.max(200, stoneSpawnRate - 50);
        lastLevelIncrease = Date.now();
    }
    
    if (player.shootCooldown > 0) {
        player.shootCooldown -= deltaTime;
    }
    
    // Update stones
    stones.forEach(stone => {
        if (!stone.active) return;
        stone.y += stone.speed * (deltaTime / 16);
        stone.rotation += stone.rotationSpeed * (deltaTime / 16);
        
        if (stone.y > canvas.height + 100) {
            stone.active = false;
            gameOver();
            return;
        }
    });
    
    // Update projectiles
    projectiles.forEach(projectile => {
        if (!projectile.active) return;
        projectile.y -= projectile.speed * (deltaTime / 16);
        
        if (projectile.y < -20) {
            projectile.active = false;
        }
    });
    
    // Collision detection
    for (let i = stones.length - 1; i >= 0; i--) {
        const stone = stones[i];
        if (!stone.active) continue;
        
        for (let j = projectiles.length - 1; j >= 0; j--) {
            const projectile = projectiles[j];
            if (!projectile.active) continue;
            
            if (checkCollision(projectile, stone)) {
                let points = stone.type.points * multiplier;
                score += points;
                
                if (stone.type.name === 'Amethyst') {
                    activateMultiplier();
                } else if (stone.type.name === 'Diamond') {
                    createExplosion(stone.x, stone.y, '#ffcc00', 50);
                    stones.forEach(s => s.active = false);
                }
                
                createExplosion(stone.x, stone.y, stone.type.color[0], 20);
                
                stone.active = false;
                projectile.active = false;
                break;
            }
        }
    }
    
    // Update particles
    particlePool.forEach(particle => {
        if (!particle.active) return;
        particle.x += particle.speedX * (deltaTime / 16);
        particle.y += particle.speedY * (deltaTime / 16);
        particle.life -= deltaTime / 2;
        if (particle.life <= 0) {
            particle.active = false;
        }
    });
    
    updateUI();
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(starCanvas, 0, 0);
    
    const time = Date.now() * 0.001;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ffffff';
    for (let i = 0; i < 20; i++) {
        const x = (i * 53) % canvas.width;
        const y = (i * 47) % canvas.height;
        const size = Math.sin(time + i) * 0.5 + 1.5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    
    drawParticles();
    
    stones.forEach(drawStone);
    
    projectiles.forEach(drawProjectile);
    
    drawPlayer();
}

function gameLoop(timestamp) {
    if (!gameRunning || isPaused) return;
    
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    
    updateGame(deltaTime);
    drawGame();
    
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameRunning = false;
    if (multiplierTimeout) {
        clearTimeout(multiplierTimeout);
    }
    finalScoreElement.textContent = score;
    finalLevelElement.textContent = level;
    gameOverScreen.style.display = 'flex';
}

function togglePause() {
    isPaused = !isPaused;
    if (!isPaused && gameRunning) {
        lastFrameTime = Date.now();
        requestAnimationFrame(gameLoop);
    }
}

// Event listeners
document.getElementById('start-btn').addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameRunning = true;
    init();
    lastLevelIncrease = Date.now();
    lastFrameTime = Date.now();
    lastFpsTime = Date.now();
    requestAnimationFrame(gameLoop);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    gameRunning = true;
    init();
    lastLevelIncrease = Date.now();
    lastFrameTime = Date.now();
    lastFpsTime = Date.now();
    requestAnimationFrame(gameLoop);
});

document.getElementById('menu-btn').addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    startScreen.style.display = 'flex';
});

// Touch controls
if (isTouchDevice) {
    movementArea.addEventListener('touchstart', (e) => {
        if (!gameRunning) return;
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        currentTouchX = touch.clientX;
        isMoving = true;
        movementIndicator.style.display = 'block';
        updateMovementIndicator(touch.clientX);
    });
    
    movementArea.addEventListener('touchmove', (e) => {
        if (!gameRunning || !isMoving) return;
        e.preventDefault();
        const touch = e.touches[0];
        currentTouchX = touch.clientX;
        updateMovementIndicator(touch.clientX);
    });
    
    movementArea.addEventListener('touchend', (e) => {
        if (!gameRunning) return;
        e.preventDefault();
        isMoving = false;
        movementIndicator.style.display = 'none';
    });
    
    function updateMovementIndicator(touchX) {
        const movementAreaRect = movementArea.getBoundingClientRect();
        const relativeX = (touchX - movementAreaRect.left) / movementAreaRect.width;
        const indicatorX = relativeX * movementAreaRect.width;
        movementIndicator.style.left = `${indicatorX - 35}px`;
    }
    
    shootBtn.addEventListener('touchstart', (e) => {
        if (!gameRunning) return;
        e.preventDefault();
        createProjectile();
    });
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    switch (e.key) {
        case 'ArrowLeft':
            leftPressed = true;
            break;
        case 'ArrowRight':
            rightPressed = true;
            break;
        case ' ':
            createProjectile();
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameRunning) return;
    switch (e.key) {
        case 'ArrowLeft':
            leftPressed = false;
            break;
        case 'ArrowRight':
            rightPressed = false;
            break;
    }
});

// Mouse controls
canvas.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;
    mouseX = e.clientX;
});

canvas.addEventListener('click', (e) => {
    if (!gameRunning) return;
    createProjectile();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        isPaused = true;
    }
});

// Initialize
window.addEventListener('resize', throttle(resizeCanvas, 100));
resizeCanvas();
initStars();