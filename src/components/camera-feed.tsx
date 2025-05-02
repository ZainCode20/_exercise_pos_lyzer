
'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Video } from 'lucide-react';

interface CameraFeedProps {
  onReady: (ready: boolean) => void;
  isActive: boolean; // Controls whether the camera should be active
}

interface CameraFeedHandle {
  captureFrame: () => Promise<string | null>;
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ onReady, isActive }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      setError(null);
      try {
        if (streamRef.current) {
            // If there's an existing stream, stop it first
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, // Prioritize front camera
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log("Camera stream started successfully.");
          onReady(true);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        let message = 'Could not access camera.';
        if (err instanceof Error) {
            if (err.name === "NotAllowedError") {
                message = "Camera permission denied. Please allow camera access in your browser settings.";
            } else if (err.name === "NotFoundError") {
                message = "No camera found. Please ensure a camera is connected and enabled.";
            } else {
                 message = `Error accessing camera: ${err.message}`;
            }
        }
        setError(message);
        onReady(false);
      }
    };

    const stopCamera = () => {
       if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        console.log("Camera stream stopped.");
        // Do not call onReady(false) here, as readiness indicates capability, not current state
      }
    };

    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    // Cleanup function
    return () => {
      stopCamera();
    };
  }, [isActive, onReady]);

  useImperativeHandle(ref, () => ({
    captureFrame: async (): Promise<string | null> => {
      if (!videoRef.current || !canvasRef.current || !streamRef.current) {
        console.warn("Capture frame called but camera is not ready or inactive.");
        return null;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
         console.error("Could not get 2D context from canvas.");
         return null;
      }

      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get the image data as a data URI (e.g., PNG or JPEG)
      // Using image/jpeg for potentially smaller size, adjust quality as needed
      try {
        const dataUri = canvas.toDataURL('image/jpeg', 0.8); // Adjust quality (0.0 to 1.0)
        // console.log("Frame captured:", dataUri.substring(0, 50) + "..."); // Log start of data URI
        return dataUri;
      } catch (e) {
          console.error("Error converting canvas to data URL:", e);
          return null;
      }
    },
  }));

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline // Important for iOS
        muted // Mute audio to avoid feedback loops if mic was enabled
        style={{ transform: 'scaleX(-1)' }} // Mirror the video feed
      />
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {error && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-red-400 p-4 text-center">
          <Video className="w-12 h-12 mb-4" />
          <p className="font-semibold">Camera Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
       {!isActive && !error && (
         <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground">
           {/* Placeholder or message when camera is inactive but no error */}
         </div>
       )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;
