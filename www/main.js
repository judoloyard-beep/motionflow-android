JavaScript

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const statusEl = document.getElementById("status");
const cameraLabel = document.getElementById("cameraLabel");
const fpsEl = document.getElementById("fps");
const engineEl = document.getElementById("engine");
const handEl = document.getElementById("hand");

let stream = null;
let worker = null;

let running = false;
let busy = false;
let modelReady = false;

let lastFrame = 0;
let frames = 0;
let fpsTimer = performance.now();

let lastScrollY = null;
let lastScrollTime = 0;
let lastPinch = false;
let lastGesture = "";

const connections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

function setStatus(value) {
  statusEl.textContent = value;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 1500);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);

function drawHand(points) {
  resizeCanvas();

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);

  if (!points) return;

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#a78bfa";
  ctx.shadowColor = "#8b5cf6";
  ctx.shadowBlur = 10;

  for (const [a, b] of connections) {
    ctx.beginPath();
    ctx.moveTo(points[a].x * width, points[a].y * height);
    ctx.lineTo(points[b].x * width, points[b].y * height);
    ctx.stroke();
  }

  points.forEach((point, index) => {
    ctx.beginPath();

    ctx.arc(
      point.x * width,
      point.y * height,
      index === 8 ? 6 : 3,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = index === 8 ? "#ffffff" : "#a78bfa";
    ctx.fill();
  });

  const tip = points[8];

  ctx.beginPath();
  ctx.arc(
    tip.x * width,
    tip.y * height,
    12,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFingerUp(points, tip, pip) {
  return points[tip].y < points[pip].y;
}

function recognize(points) {
  const index = isFingerUp(points, 8, 6);
  const middle = isFingerUp(points, 12, 10);
  const ring = isFingerUp(points, 16, 14);
  const pinky = isFingerUp(points, 20, 18);

  const thumbUp = points[4].y < points[3].y;

  const pinchDistance = distance(points[4], points[8]);
  const pinching = pinchDistance < 0.055;

  const fingersOpen = [index, middle, ring, pinky]
    .filter(Boolean).length;

  let gesture = "Tidak dikenal";

  if (pinching) {
    gesture = "Pinch";
  } else if (fingersOpen === 4) {
    gesture = "Telapak terbuka";
  } else if (fingersOpen === 0 && !thumbUp) {
    gesture = "Kepalan";
  } else if (thumbUp && fingersOpen <= 1) {
    gesture = "Jempol";
  }

  return {
    gesture,
    pinching,
    fingersOpen
  };
}

function updateGestureUI(data) {
  document.getElementById("thumb").textContent =
    data.gesture === "Jempol" ? "Terdeteksi!" : "Menunggu";

  document.getElementById("fist").textContent =
    data.gesture === "Kepalan" ? "Terdeteksi!" : "Menunggu";

  document.getElementById("palm").textContent =
    data.gesture === "Telapak terbuka" ? "Terdeteksi!" : "Menunggu";

  document.getElementById("pinch").textContent =
    data.gesture === "Pinch" ? "Terdeteksi!" : "Menunggu";
}

function handleGesture(points) {
  const data = recognize(points);

  updateGestureUI(data);

  if (
    data.gesture !== lastGesture &&
    data.gesture !== "Tidak dikenal"
  ) {
    lastGesture = data.gesture;
    toast("Gestur: " + data.gesture);
  }

  if (data.gesture === "Tidak dikenal") {
    lastGesture = "";
  }

  // Air Click
  if (data.pinching && !lastPinch) {
    const buttons = [...document.querySelectorAll(".app-btn")];

    if (buttons.length) {
      const next = (handleGesture.selected ?? -1) + 1;

      handleGesture.selected = next % buttons.length;

      buttons.forEach((button, index) => {
        button.classList.toggle(
          "active",
          index === handleGesture.selected
        );
      });

      buttons[handleGesture.selected].click();
      toast("✦ Air Click!");
    }
  }

  lastPinch = data.pinching;

  // Air Scroll
  if (data.gesture === "Telapak terbuka") {
    const palmY = points[9].y;
    const now = performance.now();

    if (
      lastScrollY !== null &&
      now - lastScrollTime > 100
    ) {
      const delta = palmY - lastScrollY;

      if (Math.abs(delta) > 0.035) {
        window.scrollBy({
          top: delta * 450,
          behavior: "auto"
        });

        lastScrollTime = now;
      }
    }

    lastScrollY = palmY;
  } else {
    lastScrollY = null;
  }
}

function handleWorkerMessage(event) {
  const data = event.data;

  if (data.type === "ready") {
    modelReady = true;

    engineEl.textContent = data.engine;
    cameraLabel.textContent = "TRACKING ACTIVE";

    setStatus("SYSTEM ONLINE");
    toast("MotionFlow siap!");

    return;
  }

  if (data.type === "result") {
    busy = false;
    frames++;

    if (data.landmarks) {
      handEl.textContent = "DETECTED";

      drawHand(data.landmarks);
      handleGesture(data.landmarks);
    } else {
      handEl.textContent = "NONE";

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      lastPinch = false;
      lastGesture = "";
      lastScrollY = null;
    }

    return;
  }

  if (data.type === "error") {
    busy = false;

    console.error(data.message);
    toast("Tracking error: " + data.message);
    setStatus("TRACKING ERROR");
  }
}

function sendFrame(now) {
  if (!running) return;

  requestAnimationFrame(sendFrame);

  if (now - fpsTimer >= 1000) {
    fpsEl.textContent = frames;
    frames = 0;
    fpsTimer = now;
  }

  if (now - lastFrame < 80) return;
  if (!modelReady || busy || !worker) return;
  if (video.readyState < 2) return;

  lastFrame = now;
  busy = true;

  createImageBitmap(video)
    .then(bitmap => {
      if (!running || !worker) {
        bitmap.close();
        busy = false;
        return;
      }

      worker.postMessage({
        type: "frame",
        bitmap,
        timestamp: now
      }, [bitmap]);
    })
    .catch(error => {
      busy = false;
      console.error(error);
    });
}

async function startTracking() {
  try {
    startBtn.disabled = true;

    setStatus("STARTING...");
    cameraLabel.textContent = "REQUESTING CAMERA";

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15, max: 20 }
      }
    });

    video.srcObject = stream;
    await video.play();

    resizeCanvas();

    worker = new Worker(
      new URL("./hand-worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = handleWorkerMessage;

    worker.onerror = error => {
      console.error(error);
      busy = false;
      modelReady = false;

      toast("Worker gagal dijalankan");
      setStatus("WORKER ERROR");
    };

    running = true;
    stopBtn.disabled = false;

    worker.postMessage({ type: "init" });

    requestAnimationFrame(sendFrame);

  } catch (error) {
    console.error(error);

    toast("Gagal membuka kamera: " + error.message);

    stopTracking();
  }
}

function stopTracking() {
  running = false;
  busy = false;
  modelReady = false;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  if (worker) {
    worker.terminate();
    worker = null;
  }

  video.srcObject = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  fpsEl.textContent = "0";
  engineEl.textContent = "--";
  handEl.textContent = "NONE";

  cameraLabel.textContent = "CAMERA STANDBY";
  setStatus("SYSTEM OFFLINE");

  lastGesture = "";
  lastPinch = false;
  lastScrollY = null;

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", startTracking);
stopBtn.addEventListener("click", stopTracking);

document.querySelectorAll(".app-btn").forEach(button => {
  button.addEventListener("click", () => {
    toast(button.textContent.trim() + " dibuka");
  });
});

window.addEventListener("beforeunload", stopTracking);

console.log("MotionFlow V2 initialized");
  
