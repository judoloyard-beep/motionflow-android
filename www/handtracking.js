
import {
  HandLandmarker,
  FilesetResolver
} from "@mediapipe/tasks-vision";

let tracker;

export async function initHandTracking(video) {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  tracker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });

  return tracker;
}

export function detectHand(video) {
  if (!tracker || video.readyState < 2) return null;

  return tracker.detectForVideo(video, performance.now());
}
