JavaScript

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const cameraLabel = document.getElementById("cameraLabel");
const toastEl = document.getElementById("toast");
alert("MAIN JS BERHASIL DIMUAT");

let stream = null;
let running = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

function showError(error) {
  console.error(error);
  setStatus("CAMERA ERROR");
  cameraLabel.textContent = error.message || "CAMERA FAILED";
  toast(error.message || "Kamera gagal dibuka");
}

async function startTracking() {
  if (running) return;

  startBtn.disabled = true;
  setStatus("STARTING...");
  cameraLabel.textContent = "REQUESTING CAMERA";
  toast("Meminta akses kamera...");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Akses kamera tidak tersedia di WebView ini.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    video.srcObject = stream;
    await video.play();

    running = true;
    stopBtn.disabled = false;

    setStatus("CAMERA ONLINE");
    cameraLabel.textContent = "CAMERA ACTIVE";
    toast("Kamera berhasil dibuka!");

  } catch (error) {
    showError(error);
    stopTracking();
  }
}

function stopTracking() {
  running = false;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  setStatus("SYSTEM OFFLINE");
  cameraLabel.textContent = "CAMERA STANDBY";

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

setStatus("JAVASCRIPT ONLINE");
cameraLabel.textContent = "CAMERA STANDBY";
toast("MotionFlow siap!");

console.log("MotionFlow diagnostic loaded");
