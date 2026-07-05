const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const gameContainer = document.querySelector('.game-container');
const boardWrap = document.querySelector('.board-wrap');
const titleEl = document.querySelector('h1');
const hudEl = document.querySelector('.hud');
const hintEl = document.querySelector('.hint');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const gameOverEl = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');

const TILE_COUNT = 20; // fixed gameplay grid, independent of screen size
const MOVE_INTERVAL = 100; // ms per step
const MIN_BOARD_SIZE = 150;

let GRID_SIZE; // pixels per tile, recomputed on resize
let canvasSize; // logical (CSS) pixel size of the square canvas
let snake, direction, nextDirection, food, score, highScore, paused, gameOver, lastMoveTime;

function resizeCanvas() {
  const containerWidth = gameContainer.clientWidth;

  // Everything vertically around the board (title, HUD, hint text, body
  // padding) eats into viewport height too, so on short/landscape screens
  // sizing the board from width alone would push content off-screen.
  const chromeHeight =
    titleEl.getBoundingClientRect().height +
    hudEl.getBoundingClientRect().height +
    hintEl.getBoundingClientRect().height;
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

function draw() {
  ctx.fillStyle = '#12121e';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const gap = Math.max(1, GRID_SIZE * 0.05);

  ctx.fillStyle = '#ff5555';
  ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE - gap, GRID_SIZE - gap);

  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#4caf50' : '#8bc34a';
    ctx.fillRect(seg.x * GRID_SIZE, seg.y * GRID_SIZE, GRID_SIZE - gap, GRID_SIZE - gap);
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
    draw();
    requestAnimationFrame(gameLoop);
  }
}

const KEY_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (!gameOver) paused = !paused;
    return;
  }

  const newDir = KEY_DIRECTIONS[e.key];
  if (!newDir) return;
  e.preventDefault();

  // Prevent reversing directly into itself
  const isOpposite = newDir.x === -direction.x && newDir.y === -direction.y;
  if (!isOpposite || snake.length === 1) {
    nextDirection = newDir;
  }
});

restartBtn.addEventListener('click', () => {
  resetGame();
  requestAnimationFrame(gameLoop);
});

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(resizeCanvas, 100);
});
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

resetGame();
resizeCanvas();
requestAnimationFrame(gameLoop);
