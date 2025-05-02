'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Video, AlertTriangle, Ban } from 'lucide-react'; // Added Ban icon

interface CameraFeedProps {
  onReady: (ready: boolean, permissionGranted: boolean | null, error?: string | null) => void; // Updated signature
  isActive: boolean; // Controls whether the camera should be active
}

interface CameraFeedHandle {
  captureFrame: () => Promise<string | null>;
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ onReady, isActive }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown'); // Track permission specifically

  // Use useCallback for functions passed to useEffect dependencies
  const reportStatus = useCallback((ready: boolean, permissionGranted: boolean | null, error?: string | null) => {
    onReady(ready, permissionGranted, error);
  }, [onReady]);

    // Use useCallback for stopCamera
    const stopCamera = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.onloadedmetadata = null;
          videoRef.current.onerror = null;
        }
        console.log("Camera stream stopped.");
        // Don't report status on stop, parent controls activation.
        // Optionally clear internal error when *manually* stopped via isActive=false?
        // setInternalError(null);
      }
    }, []); // No dependencies needed for stopCamera

  useEffect(() => {
    const startCamera = async () => {
      setInternalError(null); // Clear previous internal errors

       // --- Check Permission Status First ---
       if (navigator.permissions) {
        try {
            const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
            setPermissionState(status.state);

            status.onchange = () => {
                const newPermissionState = status.state;
                setPermissionState(newPermissionState);
                // If permission changes to denied while active, stop the camera and report error
                if (newPermissionState === 'denied' && streamRef.current) {
                    stopCamera();
                    const message = "Camera permission was revoked.";
                    setInternalError(message);
                    reportStatus(false, false, message);
                } else if (newPermissionState === 'granted' && isActive && !streamRef.current) {
                    startCamera(); // Re-call startCamera to attempt initialization
                } else if (newPermissionState === 'granted' && isActive && streamRef.current){
                    // Permission granted while already active? Ensure status is reported correctly.
                     reportStatus(true, true, null); // Report ready status again
                     setInternalError(null); // Clear any potential prompt messages
                } else if (newPermissionState === 'prompt') {
                     // If permission reverts to prompt (unlikely but possible), update state
                     setPermissionState('prompt');
                     reportStatus(false, null, "Camera permission required."); // Not ready, permission unknown/prompt
                }

            };

            if (status.state === 'denied') {
                const message = "Camera permission denied. Please allow camera access in browser settings.";
                setInternalError(message);
                reportStatus(false, false, message); // Explicitly false for permission
                return; // Don't try getUserMedia if denied
            }
             // If state is 'prompt' or 'granted', proceed to getUserMedia
             // If state is 'unknown', also proceed, getUserMedia will handle it

        } catch (permError) {
            console.warn('Permission API query failed:', permError);
            setPermissionState('unknown'); // Fallback if query fails
            // Proceed, getUserMedia might still work or provide a clearer error
        }
      } else {
          console.warn("Permissions API not supported. Proceeding with getUserMedia.");
          setPermissionState('unknown'); // Cannot determine state beforehand
      }
       // --- End Permission Check ---


      // Ensure previous stream is stopped before starting a new one
      stopCamera(); // Use stopCamera to clean up existing stream if any

      try {
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, // Consider adding specific constraints if needed
          audio: false,
        });
        streamRef.current = stream;
        setPermissionState('granted'); // Explicitly set granted after successful getUserMedia
        setInternalError(null); // Clear any previous "prompt" state errors

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure the video element is ready before playing
          videoRef.current.onloadedmetadata = async () => {
              try {
                  await videoRef.current?.play();
                  console.log("Camera stream started successfully.");
                  reportStatus(true, true, null); // Pass null error on success, true for permission
              } catch (playError) {
                  console.error('Error playing video stream:', playError);
                  const message = "Could not start camera video playback.";
                  setInternalError(message);
                  reportStatus(false, true, message); // Still have permission, but playback failed
                  // Stop tracks if playback fails
                  stopCamera();
              }
          };
           // Handle potential errors during loading
          videoRef.current.onerror = () => {
            console.error('Error loading video stream.');
            const message = "Error loading video stream.";
            setInternalError(message);
            reportStatus(false, true, message); // Still have permission, but loading failed
            // Stop tracks if loading fails
             stopCamera();
          }

        } else {
             const message = "Video element not available.";
             setInternalError(message);
             reportStatus(false, true, message); // Permission granted, but component issue
             stopCamera();
        }
      } catch (err) {
        console.error('Error accessing camera via getUserMedia:', err);
        let message = 'Could not access camera.';
        let permissionDenied = false;
        if (err instanceof Error) {
          switch (err.name) {
            case "NotAllowedError": // Standard Permission Denied
            case "PermissionDeniedError": // Firefox specific
              message = "Camera permission denied. Please allow camera access in your browser settings.";
              permissionDenied = true;
              setPermissionState('denied');
              break;
            case "NotFoundError": // No camera hardware
              message = "No camera found. Please ensure a camera is connected and enabled.";
              break;
            case "NotReadableError": // Hardware error, or OS/other app using camera
              message = "Camera is currently unavailable. It might be used by another application or there could be a hardware issue.";
              break;
            case "OverconstrainedError": // Requested constraints (e.g., resolution) not met
               message = "Could not satisfy camera constraints (e.g., resolution).";
               break;
            case "AbortError": // User or browser aborted the request
              message = "Camera access request was cancelled.";
              break;
            case "SecurityError": // Often related to non-HTTPS origins
                message = "Camera access denied due to security settings. Ensure the page is served over HTTPS.";
                break;
             case "TypeError": // Invalid constraints passed to getUserMedia
                message = "Invalid camera configuration requested.";
                break;
            default:
              message = `An unexpected error occurred while accessing the camera: ${err.message}`;
          }
        }
        setInternalError(message); // Set internal error for display on the feed
        reportStatus(false, permissionDenied ? false : null, message); // False for permission only if explicitly denied
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
       // Clean up permission listener if added
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'camera' as PermissionName })
          .then(status => status.onchange = null)
          .catch(e => console.warn("Could not remove permission listener", e));
      }
    };
  // Re-run if isActive changes or reportStatus/stopCamera function identity changes (should be stable with useCallback)
  }, [isActive, reportStatus, stopCamera]);

  useImperativeHandle(ref, () => ({
    captureFrame: async (): Promise<string | null> => {
      // Check if stream exists, video element is ready, and camera should be active
      if (!videoRef.current?.srcObject || !videoRef.current?.videoWidth || !canvasRef.current || !streamRef.current || !isActive) {
        console.warn("Capture frame called but camera is not ready, not active, or stream is missing.");
        return null;
      }
      // Additional check for permission state
       if (permissionState !== 'granted') {
           console.warn("Capture frame called but camera permission is not granted.");
           return null;
       }


      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
         console.error("Could not get 2D context from canvas.");
         return null;
      }

      // Set canvas dimensions matching the video feed
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        // Draw mirrored frame onto the canvas
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for subsequent draws if needed

        // Convert canvas to Data URI
        const dataUri = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller size, adjust quality (0.8) as needed
        return dataUri;
      } catch (e) {
          console.error("Error converting canvas to data URL:", e);
          // Could be due to tainted canvas (CORS) if video source was remote, but unlikely for getUserMedia
          return null;
      }
    },
  }), [isActive, permissionState]); // Depend on isActive and permissionState

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-muted overflow-hidden rounded-md">
       {/* Video Element: Always render, but hide if inactive or error */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${isActive && !internalError ? 'block' : 'hidden'}`} // Show only if active and no error
        playsInline // Essential for mobile playback
        muted     // Muted to avoid feedback loops and comply with autoplay policies
        autoPlay  // Attempt to autoplay when stream is attached
        style={{ transform: 'scaleX(-1)' }} // Mirror the video feed for a natural user view
      />
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Display internal errors directly on the feed */}
      {internalError && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-red-400 p-4 text-center z-10 rounded-md">
           {permissionState === 'denied' ? (
             <Ban className="w-12 h-12 mb-4 text-red-500" />
           ) : (
             <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
           )}
          <p className="font-semibold text-lg mb-2">Camera Error</p>
          <p className="text-sm">{internalError}</p>
        </div>
      )}

       {/* Show placeholder if camera is inactive AND no error is present */}
       {!isActive && !internalError && (
         <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground rounded-md">
           <Video className="w-16 h-16 mb-4" />
           <p>Camera is off</p>
         </div>
       )}
        {/* Show placeholder if camera is active but permission is pending/prompt */}
       {isActive && permissionState === 'prompt' && !internalError && (
         <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground rounded-md">
           <Video className="w-16 h-16 mb-4 animate-pulse" />
           <p>Waiting for camera permission...</p>
         </div>
       )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;
