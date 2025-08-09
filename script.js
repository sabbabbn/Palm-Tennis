// script.js — Palm Pong with 5s countdown, max score 10, and Restart button

const videoElement = document.getElementById('webcam');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const restartBtn = document.getElementById('restartBtn');

const W = canvas.width;
const H = canvas.height;

// paddles
const paddleWidth = 12;
const paddleHeight = 120;
const playerX = 20;
const aiX = W - 20 - paddleWidth;
let playerY = (H - paddleHeight) / 2;
let aiY = (H - paddleHeight) / 2;
const aiSpeed = 3.5;

// ball
let ballRadius = 10;
let ballX = W / 2;
let ballY = H / 2;
let ballSpeedX = 5 * (Math.random() > 0.5 ? 1 : -1);
let ballSpeedY = 3 * (Math.random() > 0.5 ? 1 : -1);

// scores and state
let playerScore = 0;
let aiScore = 0;
const MAX_SCORE = 10;

let countdown = 5;
let gameStarted = false;     // becomes true after countdown finishes
let roundActive = false;     // ball moves only when true
let gameOver = false;

let countdownTimer = null;
let overlayMsg = "";
let overlayTimer = null;

// --- MediaPipe Hands setup (palm controls left paddle vertically) ---
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.5
});
hands.onResults(onHandsResults);

const camera = new Camera(videoElement, {
  onFrame: async () => { await hands.send({ image: videoElement }); },
  width: W, height: H
});
camera.start().catch(err => {
  console.error("Camera start failed:", err);
  overlayMsg = "Camera error — check permissions (dev console).";
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(()=> overlayMsg = "", 4000);
});

// Use palm center (landmark 9) to control paddleY
function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const lm = results.multiHandLandmarks[0];
    const palm = lm[9];
    playerY = palm.y * H - paddleHeight / 2;
    playerY = Math.max(0, Math.min(H - paddleHeight, playerY));
  }
}

// --- Helpers ---
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function showOverlay(text, ms = 1200) {
  overlayMsg = text;
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => { overlayMsg = ""; }, ms);
}

// Reset ball to center and start countdown (ball won't move until countdown ends)
function resetBall(towardsRight = true) {
  ballX = W / 2;
  ballY = H / 2;
  const angle = (Math.random() * 0.6 - 0.3);
  const speed = 5 + Math.random() * 1.5;
  ballSpeedX = (towardsRight ? 1 : -1) * speed;
  ballSpeedY = speed * angle;
  roundActive = false;
  gameStarted = false;
  startCountdown();
}

function startCountdown(duration = 5) {
  // clear old timer if exists
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdown = duration;
  gameStarted = false;
  roundActive = false;
  // Show initial message immediately
  showOverlay(`Starting in ${countdown}`, 800);
  countdownTimer = setInterval(() => {
    countdown--;
    // keep overlay updated
    if (countdown >= 1) {
      showOverlay(`Starting in ${countdown}`, 900);
    } else if (countdown === 0) {
      showOverlay("GO!", 900);
    } else { // countdown < 0 -> start
      clearInterval(countdownTimer);
      countdownTimer = null;
      gameStarted = true;
      roundActive = true;
    }
  }, 1000);
}

function handleScore(winner) {
  if (winner === 'player') {
    playerScore++;
    showOverlay("You score!", 900);
  } else {
    aiScore++;
    showOverlay("AI scores!", 900);
  }

  // check end of match
  if (playerScore >= MAX_SCORE || aiScore >= MAX_SCORE) {
    gameOver = true;
    roundActive = false;
    gameStarted = false;
    if (aiScore >= MAX_SCORE) {
      setTimeout(() => {
        document.getElementById('aiWinSound').play();
      }, 500);
    }
    // show Restart button
    if (restartBtn) restartBtn.style.display = "block";
    showOverlay(playerScore >= MAX_SCORE ? "You win! 🎉" : "AI wins! 🤖", 3000);
    return;
  }

  // start next round with ball toward the side that lost last point
  // If player scored, send ball towards AI (towardsRight=true)
  // If AI scored, send ball towards player (towardsRight=false)
  resetBall(winner === 'player' ? true : false);
}

// --- Game update & draw ---
function update() {
  if (roundActive) {
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // top/bottom bounce
    if (ballY - ballRadius < 0) {
      ballY = ballRadius;
      ballSpeedY = -ballSpeedY;
    } else if (ballY + ballRadius > H) {
      ballY = H - ballRadius;
      ballSpeedY = -ballSpeedY;
    }

    // player paddle collision (left)
    if (ballX - ballRadius < playerX + paddleWidth) {
      if (ballY > playerY && ballY < playerY + paddleHeight) {
        // compute hit relative position to add angle
        const relative = (ballY - (playerY + paddleHeight / 2)) / (paddleHeight / 2);
        const speed = Math.max(5, Math.abs(ballSpeedX)) + 0.4;
        ballSpeedX = Math.abs(speed);
        ballSpeedY = relative * 5;
        ballX = playerX + paddleWidth + ballRadius;
      }
    }

    // ai paddle collision (right)
    if (ballX + ballRadius > aiX) {
      if (ballY > aiY && ballY < aiY + paddleHeight) {
        const relative = (ballY - (aiY + paddleHeight / 2)) / (paddleHeight / 2);
        const speed = Math.max(5, Math.abs(ballSpeedX)) + 0.4;
        ballSpeedX = -Math.abs(speed);
        ballSpeedY = relative * 5;
        ballX = aiX - ballRadius;
      }
    }

    // left miss -> AI scores
    if (ballX - ballRadius < 0) {
      handleScore('ai');
      return;
    }

    // right miss -> Player scores
    if (ballX + ballRadius > W) {
      handleScore('player');
      return;
    }
  }

  // simple AI: follow ball Y
  const aiCenter = aiY + paddleHeight / 2;
  if (aiCenter < ballY - 8) aiY += aiSpeed;
  else if (aiCenter > ballY + 8) aiY -= aiSpeed;
  aiY = clamp(aiY, 0, H - paddleHeight);
}

function draw() {
  // background
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, W, H);

  // center dashed line
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 10);
  ctx.lineTo(W / 2, H - 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // paddles
  ctx.fillStyle = "#00ff99";
  ctx.fillRect(playerX, playerY, paddleWidth, paddleHeight);

  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(aiX, aiY, paddleWidth, paddleHeight);

  // ball
  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fill();

  // scores
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Player: " + playerScore, 14, 28);
  ctx.textAlign = "right";
  ctx.fillText("AI: " + aiScore, W - 14, 28);

  // overlay message (countdown, GO!, or temporary messages)
  if (!gameStarted && !gameOver) {
    // semi-transparent overlay
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffd700";
    ctx.font = "72px Arial";
    ctx.textAlign = "center";
    const text = countdown > 0 ? countdown.toString() : "GO!";
    ctx.fillText(text, W / 2, H / 2 + 24);
  }

  // temporary overlayMsg (small)
  if (overlayMsg) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(W / 2 - 160, 10, 320, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(overlayMsg, W / 2, 34);
  }

  // game over display
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffe66d";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 20);
    ctx.font = "28px Arial";
    ctx.fillText(playerScore >= MAX_SCORE ? "You Win! 🎉" : "AI Wins! 🤖", W / 2, H / 2 + 28);
  }
}

// main loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// Restart button handler
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    playerScore = 0;
    aiScore = 0;
    gameOver = false;
    restartBtn.style.display = "none";
    resetBall(true);
  });
  // hide at start
  restartBtn.style.display = "none";
}

// Kick things off
resetBall(true); // centering and start countdown
loop();
