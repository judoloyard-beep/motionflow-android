
import {
  FilesetResolver,
  HandLandmarker
} from "@mediapipe/tasks-vision";

let detector = null;

self.onmessage = async (event) => {
  const { type, bitmap, timestamp } = event.data;

  if (type === "init") {
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

      try {
        detector = await HandLandmarker.createFromOptions(
          vision, options
        );
        self.postMessage({ type: "ready", engine: "GPU" });

      } catch (gpuError) {
        console.warn("GPU unavailable:", gpuError);

        options.baseOptions.delegate = "CPU";

        detector = await HandLandmarker.createFromOptions(
          vision, options
        );

        self.postMessage({ type: "ready", engine: "CPU" });
      }

    } catch (error) {
      self.postMessage({
        type: "error",
        message: error.message
      });
    }

    return;
  }

  if (type === "frame" && detector) {
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
        message: error.message
      });

    } finally {
      bitmap?.close();
    }
  }
};
