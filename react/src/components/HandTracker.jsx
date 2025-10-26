import React, { useRef, useEffect, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

const HandTracker = ({ onHandUpdate }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [handCenters, setHandCenters] = useState([]);

  useEffect(() => {
    if (!videoRef.current) return;

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
      modelComplexity: 1,
    });

    hands.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => await hands.send({ image: videoRef.current }),
      width: 640,
      height: 480,
    });

    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, []);

  const onResults = (results) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mirror canvas for selfie mode
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const centers = [];

    if (results.multiHandLandmarks && results.multiHandedness) {
      results.multiHandLandmarks.forEach((landmarks, i) => {
        const label = results.multiHandedness[i].label.toLowerCase();

        const xCenter =
          landmarks.reduce((sum, lm) => sum + lm.x, 0) / landmarks.length;
        const yCenter =
          landmarks.reduce((sum, lm) => sum + lm.y, 0) / landmarks.length;

        const x = xCenter * canvas.width;
        const y = yCenter * canvas.height;

        ctx.fillStyle = label === "left" ? "blue" : "red";
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fill();

        centers.push({ x, y, label });
      });
    }

    ctx.restore();

    setHandCenters(centers);       // update state
    if (onHandUpdate) onHandUpdate(centers); // send to parent
  };

  return (
    <div style={{ position: "relative", width: 640, height: 480 }}>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        autoPlay
        playsInline
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ border: "1px solid black" }}
      />
    </div>
  );
};

export default HandTracker;
