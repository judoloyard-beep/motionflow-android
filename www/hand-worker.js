JavaScript

import {
  FilesetResolver,
  HandLandmarker
} from "@mediapipe/tasks-vision";

let detector = null;
let initializing = false;
let ready = false;

self.onmessage = async (event) => {
  const { type, bitmap, timestamp } = event.data;

  if (type === "init") {
    if (initializing || ready) return;

    initializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      const options = {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      };

      let engine = "GPU";

      try {
        detector = await HandLandmarker.createFromOptions(
          vision,
          options
        );
      } catch (gpuError) {
        console.warn("GPU unavailable, switching to CPU", gpuError);

        options.baseOptions.delegate = "CPU";

        detector = await HandLandmarker.createFromOptions(
          vision,
          options
        );

        engine = "CPU";
      }

      ready = true;

      self.postMessage({
        type: "ready",
        engine
      });

    } catch (error) {
      self.postMessage({
        type: "error",
        message: error.message || "Model initialization failed"
      });

    } finally {
      initializing = false;
    }

    return;
  }

  if (type === "frame") {
    if (!ready || !detector) {
      bitmap?.close();
      return;
    }

    try {
      const result = detector.detectForVideo(
        bitmap,
        timestamp
      );

      self.postMessage({
        type: "result",
        landmarks: result.landmarks?.[0] || null,
        timestamp
      });

    } catch (error) {
      self.postMessage({
        type: "error",
        message: error.message || "Detection failed"
      });

    } finally {
      bitmap?.close();
    }
  }
};
