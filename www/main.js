JavaScript

import { Capacitor } from "@capacitor/core";

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
let lastFrame = 0;
let lastResultTime = 0;
let frames = 0;
let fpsTimer = 0;
let lastScrollY = null;
let lastScrollTime = 0;
let lastPinch = false;
let lastGesture = "";
let currentLandmarks = null;

const connections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

function setStatus(text) {
  statusEl.textContent = text;
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

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);

function drawHand(points) {
  resizeCanvas();

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);

  if (!points) return;

  // Garis tangan neon
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#a78bfa";
  ctx.shadowColor = "#8b5cf6";
  ctx.shadowBlur = 12;

  for (const [a, b] of connections) {
    const p1 = points[a];
    const p2 = points[b];

    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  }

  // Titik landmark
  ctx.shadowBlur = 15;

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

  // Cursor telunjuk
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

  const thumbDistance = distance(points[4], points[5]);
  const thumbUp = points[4].y < points[3].y &&
                  thumbDistance > 0.12;

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
    fingersOpen,
    index
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

  if (data.gesture !== lastGesture &&
      data.gesture !== "Tidak dikenal") {
    lastGesture = data.gesture;
    toast("Gestur: " + data.gesture);
  }

  if (data.gesture === "Tidak dikenal") {
    lastGesture = "";
  }

  // Pinch: klik tombol workspace secara berurutan
  if (data.pinching && !lastPinch) {
    toast("✦ Air Click!");

    const buttons = [
      ...document.querySelectorAll(".app-btn")
    ];

    const next = (handleGesture.selected || -1) + 1;
    handleGesture.selected = next % buttons.length;

    buttons.forEach((button, index) => {
      button.classList.toggle("active", index === handleGesture.selected);
    });

    buttons[handleGesture.selected]?.click();
  }

  lastPinch = data.pinching;

  // Air Scroll: gerakkan telapak ke atas/bawah
  if (data.gesture === "Telapak terbuka") {
    const palmY = points[9].y;
    const now = performance.now();

    if (lastScrollY !== null && now - lastScrollTime > 100) {
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
    engineEl.textContent = data.engine;
    cameraLabel.textContent = "TRACKING ACTIVE";
    setStatus("SYSTEM ONLINE");
    toast("MotionFlow siap!");
  }

  if (data.type === "result") {
    busy = false;
    frames++;

    currentLandmarks = data.landmarks;

    if (currentLandmarks) {
      handEl.textContent = "DETECTED";
      drawHand(currentLandmarks);
      handleGesture(currentLandmarks);
    } else {
      handEl.textContent = "NONE";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastPinch = false;
      lastGesture = "";
      lastScrollY = null;
    }
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

  // Batasi proses kamera sekitar 12 FPS
  if (now - lastFrame < 80) return;
  if (busy || video.readyState < 2 || !worker) return;

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

  if (now - fpsTimer >= 1000) {
    fpsEl.textContent = frames;
    frames = 0;
    fpsTimer = now;
  }
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

    worker = new Worker(
      new URL("./hand-worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = handleWorkerMessage;

    worker.onerror = error => {
      console.error(error);
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
    setStatus("CAMERA ERROR");
    startBtn.disabled = false;
    stopTracking();
  }
}

function stopTracking() {
  running = false;
  busy = false;

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

if (!navigator.mediaDevices?.getUserMedia) {
  toast("Browser tidak mendukung kamera");
}

console.log("MotionFlow V2 initialized");
          
