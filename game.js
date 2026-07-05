const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const gameContainer = document.querySelector('.game-container');
const boardWrap = document.querySelector('.board-wrap');
const titleEl = document.querySelector('h1');
const hudEl = document.querySelector('.hud');
const hintEl = document.querySelector('.hint');
const dpadEl = document.querySelector('.dpad');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const gameOverEl = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');

const TILE_COUNT = 20; // fixed gameplay grid, independent of screen size
const MOVE_INTERVAL = 100; // ms per step
const MIN_BOARD_SIZE = 150;

let GRID_SIZE; // pixels per tile, recomputed on resize
let canvasSize; // logical (CSS) pixel size of the square canvas
let bgGradient = null; // cached background gradient, rebuilt on resize
let snake, direction, nextDirection, food, score, highScore, paused, gameOver, lastMoveTime;

const HEAD_RGB = [76, 175, 80]; // #4caf50
const TAIL_RGB = [139, 195, 74]; // #8bc34a

function lerpColor(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function fillRoundedRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
}

function rebuildBackground() {
  bgGradient = ctx.createRadialGradient(
    canvasSize / 2, canvasSize / 2, 0,
    canvasSize / 2, canvasSize / 2, canvasSize * 0.75
  );
  bgGradient.addColorStop(0, '#181830');
  bgGradient.addColorStop(1, '#0d0d16');
}

function resizeCanvas() {
  const containerWidth = gameContainer.clientWidth;

  // Everything vertically around the board (title, HUD, hint text, body
  // padding) eats into viewport height too, so on short/landscape screens
  // sizing the board from width alone would push content off-screen.
  const chromeHeight =
    titleEl.getBoundingClientRect().height +
    hudEl.getBoundingClientRect().height +
    hintEl.getBoundingClientRect().height +
    dpadEl.getBoundingClientRect().height; // 0 when hidden (desktop, pointer:fine)
  const bodyStyle = getComputedStyle(document.body);
  const bodyPadding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
  const verticalGaps = 48; // margins between title/HUD/board/hint + subpixel safety margin
  const availableHeight = window.innerHeight - chromeHeight - bodyPadding - verticalGaps;

  const size = Math.max(MIN_BOARD_SIZE, Math.min(containerWidth, availableHeight));
  const dpr = window.devicePixelRatio || 1;

  canvasSize = size;
  GRID_SIZE = size / TILE_COUNT;
  boardWrap.style.width = `${size}px`;
  boardWrap.style.height = `${size}px`;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rebuildBackground();
  if (snake) draw();
}

function loadHighScore() {
  return Number(localStorage.getItem('snakeHighScore') || 0);
}

function saveHighScore(value) {
  localStorage.setItem('snakeHighScore', String(value));
}

function randomFoodPosition() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * TILE_COUNT),
      y: Math.floor(Math.random() * TILE_COUNT),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

function resetGame() {
  snake = [{ x: 10, y: 10 }];
  direction = { x: 0, y: 0 };
  nextDirection = { x: 0, y: 0 };
  score = 0;
  paused = false;
  gameOver = false;
  highScore = loadHighScore();
  food = randomFoodPosition();
  scoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  gameOverEl.classList.add('hidden');
  lastMoveTime = 0;
}

function triggerScorePop() {
  scoreEl.classList.remove('score-pop');
  void scoreEl.offsetWidth; // force reflow so re-adding the class restarts the animation
  scoreEl.classList.add('score-pop');
}

function update() {
  direction = nextDirection;
  if (direction.x === 0 && direction.y === 0) return;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  const hitWall = head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT;
  const hitSelf = snake.some(seg => seg.x === head.x && seg.y === head.y);

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    triggerScorePop();
    food = randomFoodPosition();
  } else {
    snake.pop();
  }
}

function endGame() {
  gameOver = true;
  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
    highScoreEl.textContent = highScore;
  }
  gameOverEl.classList.remove('hidden');
}

function draw(timestamp = performance.now()) {
  ctx.fillStyle = bgGradient || '#12121e';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 1; i < TILE_COUNT; i++) {
    const p = Math.round(i * GRID_SIZE) + 0.5; // +0.5 for crisp 1px lines
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvasSize);
    ctx.moveTo(0, p);
    ctx.lineTo(canvasSize, p);
    ctx.stroke();
  }

  const gap = Math.max(1, GRID_SIZE * 0.05);
  const radius = GRID_SIZE * 0.25;

  // Food: rounded, glowing, gently pulsing/rotating (purely time-driven, independent of the move tick)
  const pulse = 1 + 0.12 * Math.sin(timestamp / 220);
  const angle = (timestamp / 900) % (Math.PI / 2);
  const fx = food.x * GRID_SIZE + GRID_SIZE / 2;
  const fy = food.y * GRID_SIZE + GRID_SIZE / 2;
  const fw = (GRID_SIZE - gap) * pulse;

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(255,85,85,0.8)';
  ctx.shadowBlur = GRID_SIZE * 0.6;
  ctx.fillStyle = '#ff5555';
  fillRoundedRect(-fw / 2, -fw / 2, fw, fw, fw * 0.25);
  ctx.restore();

  snake.forEach((seg, i) => {
    const t = snake.length > 1 ? i / (snake.length - 1) : 0;
    const x = seg.x * GRID_SIZE;
    const y = seg.y * GRID_SIZE;
    const w = GRID_SIZE - gap;

    if (i === 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(76,175,80,0.6)';
      ctx.shadowBlur = GRID_SIZE * 0.5;
      ctx.fillStyle = lerpColor(HEAD_RGB, TAIL_RGB, t);
      fillRoundedRect(x, y, w, w, radius);
      ctx.restore();
    } else {
      ctx.fillStyle = lerpColor(HEAD_RGB, TAIL_RGB, t);
      fillRoundedRect(x, y, w, w, radius);
    }
  });

  if (paused && !gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(16, canvasSize * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused', canvasSize / 2, canvasSize / 2);
  }
}

function gameLoop(timestamp) {
  if (!gameOver) {
    if (!paused && timestamp - lastMoveTime >= MOVE_INTERVAL) {
      lastMoveTime = timestamp;
      update();
    }
    draw(timestamp);
    requestAnimationFrame(gameLoop);
  }
}

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const KEY_DIRECTIONS = {
  ArrowUp: DIRECTIONS.up,
  ArrowDown: DIRECTIONS.down,
  ArrowLeft: DIRECTIONS.left,
  ArrowRight: DIRECTIONS.right,
};

function setDirection(newDir) {
  // Prevent reversing directly into itself
  const isOpposite = newDir.x === -direction.x && newDir.y === -direction.y;
  if (!isOpposite || snake.length === 1) {
    nextDirection = newDir;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (!gameOver) paused = !paused;
    return;
  }

  const newDir = KEY_DIRECTIONS[e.key];
  if (!newDir) return;
  e.preventDefault();
  setDirection(newDir);
});

document.querySelectorAll('.dpad-btn').forEach((btn) => {
  const dir = DIRECTIONS[btn.dataset.dir];
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setDirection(dir);
  });
});

// Swipe-to-steer / tap-to-pause on the board itself
const SWIPE_THRESHOLD = 24; // px
let touchStartX = 0;
let touchStartY = 0;

boardWrap.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

boardWrap.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) {
    if (!gameOver) paused = !paused;
    return;
  }

  if (absDx > absDy) {
    setDirection(dx > 0 ? DIRECTIONS.right : DIRECTIONS.left);
  } else {
    setDirection(dy > 0 ? DIRECTIONS.down : DIRECTIONS.up);
  }
}, { passive: true });

restartBtn.addEventListener('click', () => {
  resetGame();
  requestAnimationFrame(gameLoop);
});

scoreEl.addEventListener('animationend', () => scoreEl.classList.remove('score-pop'));

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(resizeCanvas, 100);
});
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

resetGame();
resizeCanvas();
requestAnimationFrame(gameLoop);
