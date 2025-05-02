
'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeExerciseForm } from '@/ai/flows/analyze-exercise-form';
import type { AnalyzeExerciseFormOutput } from '@/ai/flows/analyze-exercise-form';
import CameraFeed from '@/components/camera-feed';
import FeedbackDisplay from '@/components/feedback-display';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Zap, Video, VideoOff, Ban } from 'lucide-react'; // Added Ban
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

const EXERCISES = ['Squat', 'Push-up', 'Lunge', 'Plank', 'Bicep Curl']; // Example exercises
const ANALYSIS_INTERVAL = 5000; // Analyze every 5 seconds

export default function Home() {
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<AnalyzeExerciseFormOutput | null>(null);
  const [error, setError] = useState<string | null>(null); // Stores general or camera errors
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // Added state for permission

  const cameraFeedRef = useRef<{ captureFrame: () => Promise<string | null> }>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Use a ref to track if analysis *should* be running, independent of async operations
  // Moved this outside of startAnalysis to fix hook call error
  const isAnalyzingRef = useRef(isAnalyzing);
  const { toast } = useToast();

   // Define stopAnalysis first as other callbacks depend on it
  const stopAnalysis = useCallback(() => {
    // Clear the interval if it exists
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
      console.log("Analysis interval cleared.");
    }
    // Reset analysis and loading states if they were active
    setIsAnalyzing(false);
    setIsLoading(false);
    isAnalyzingRef.current = false; // Update the ref when stopping
    console.log("Analysis stopped.");
    // Optional: Clear feedback when stopping analysis?
    // setFeedback(null);
  }, []); // Dependency: isAnalyzingRef (setter is stable, but good practice)

  // Define handleCameraReady next
  const handleCameraReady = useCallback((ready: boolean, permissionGranted: boolean | null, cameraError?: string | null) => {
    setIsCameraReady(ready);
    setHasCameraPermission(permissionGranted); // Update permission state

    if (!ready || permissionGranted === false) {
        // If camera is not ready OR permission is denied
        const errorMessage = cameraError || (permissionGranted === false
            ? "Camera permission denied. Please allow camera access in browser settings."
            : "Camera not available. Check hardware or other apps using it.");
        setError(errorMessage); // Display the specific error
        // If the camera was supposed to be on but isn't ready/has no permission, turn the state off and stop analysis
        if (isCameraOn) {
            setIsCameraOn(false);
            stopAnalysis();
        }
    } else if (ready && permissionGranted === true) {
        // If camera becomes ready with permission, clear any previous errors
        setError(null);
    }
    // If ready is true but permissionGranted is null, it means we are still waiting or haven't asked.
    // Don't clear error in this intermediate state. Let the CameraFeed handle displaying prompts.
  }, [stopAnalysis, isCameraOn]); // Dependency: stopAnalysis, isCameraOn


  const handleCameraToggle = useCallback(() => {
    const turningOn = !isCameraOn;
    setIsCameraOn(turningOn); // Toggle the desired state

    if (!turningOn) {
      stopAnalysis(); // Stop analysis if camera is manually turned off
      // Optionally clear specific errors when turning off, or leave them if they are persistent hardware issues.
      // setError(null) // Example: If you want to clear errors on manual turn-off
    } else {
      // When *requesting* to turn on, clear previous general errors
      // EXCEPT for persistent permission denial errors.
      if (hasCameraPermission !== false) {
        setError(null);
      }
      // CameraFeed component's useEffect triggered by `isActive={true}` will now attempt to start
      // and the `onReady` callback (handleCameraReady) will handle success/failure/permission updates.
    }
  }, [isCameraOn, stopAnalysis, hasCameraPermission]);


  // Define startAnalysis last
  const startAnalysis = useCallback(async () => {
    setError(null); // Clear previous analysis errors before starting

    if (!selectedExercise) {
      toast({
        title: "Select Exercise",
        description: "Please select an exercise before starting analysis.",
        variant: "default",
      });
      return;
    }
     if (!isCameraOn) {
      toast({
        title: "Camera Off",
        description: "Please turn the camera on.",
        variant: "default",
      });
      return;
    }
     if (hasCameraPermission !== true) { // Strict check for granted permission
        toast({
            title: "Permission Required",
            description: error || "Camera permission is required or still pending. Please enable it.",
            variant: "destructive",
        });
        return;
     }
    if (!isCameraReady) { // Check if camera hardware/stream is actually ready
       toast({
        title: "Camera Not Ready",
        description: error || "The camera is initializing or not ready. Please wait or check hardware.",
        variant: "destructive",
      });
      return;
    }
    if (!cameraFeedRef.current) {
        toast({
          title: "Camera Error",
          description: "Camera component is not available.",
          variant: "destructive",
        });
        return;
    }


    setFeedback(null);
    setIsLoading(true); // Set loading true at the start
    setIsAnalyzing(true);
    isAnalyzingRef.current = true; // Set the ref to true when starting
    console.log("Starting analysis...");


    const performAnalysis = async () => {
        // Re-check conditions before capturing frame inside interval
        // Check if analysis was stopped using the ref
        if (!isAnalyzingRef.current) {
            console.log("Analysis stopped externally, skipping analysis cycle.");
            // Ensure the interval is cleared if the ref says we stopped
            if (analysisIntervalRef.current) {
              clearInterval(analysisIntervalRef.current);
              analysisIntervalRef.current = null;
              console.log("Interval cleared from within performAnalysis due to external stop.");
            }
            return;
        }
         if (!cameraFeedRef.current || !isCameraOn || !isCameraReady || hasCameraPermission !== true) {
            console.log("Camera became unavailable, lost permission, or turned off during analysis.");
            const currentError = error || "Camera became unavailable, permission was lost, or it was turned off during analysis.";
            setError(currentError);
            stopAnalysis(); // Stop analysis if camera state changes unfavorably
            toast({
                title: "Camera Issue",
                description: currentError,
                variant: "destructive"
            });
            return;
        };

        try {
            console.log("Attempting to capture frame...");
            const videoDataUri = await cameraFeedRef.current.captureFrame();
            console.log("Frame captured:", videoDataUri ? `Data URI (${videoDataUri.length} chars)` : "null");

            if (videoDataUri) {
                 console.log("Sending frame to AI for analysis...");
                const result = await analyzeExerciseForm({
                    videoDataUri: videoDataUri,
                    exerciseType: selectedExercise,
                });
                console.log("AI Analysis Result:", result);
                 // Only update state if analysis is still supposed to be running (check ref)
                 if (isAnalyzingRef.current) {
                    setFeedback(result);
                    setError(null); // Clear previous analysis errors on success
                 } else {
                    console.log("Analysis stopped before AI result arrived.");
                 }
            } else {
                 console.warn("Failed to capture frame. Skipping this analysis cycle.");
                 // Consider adding a toast notification here if it happens repeatedly.
                 // toast({ title: "Warning", description: "Could not capture frame.", variant: "default" });
            }
        } catch (err) {
            console.error('Error during AI analysis:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
             // Only update state if analysis is still supposed to be running (check ref)
            if (isAnalyzingRef.current) {
                setError(`AI Error: ${errorMessage}`); // Prefix AI errors
                setFeedback(null); // Clear feedback on error
                toast({
                    title: "Analysis Error",
                    description: errorMessage,
                    variant: "destructive",
                  });
                stopAnalysis(); // Stop analysis completely on AI error
            } else {
                console.log("AI Error occurred after analysis stopped.");
            }
        } finally {
             // Ensure loading state is correctly managed, especially for the first analysis run.
             // The logic below handles setting isLoading=false after the first run.
        }
    };


    // Stop any existing interval *before* starting a new one or the initial analysis
    if (analysisIntervalRef.current) {
       clearInterval(analysisIntervalRef.current);
       analysisIntervalRef.current = null;
       console.log("Cleared previous analysis interval.");
    }
    // Set states *after* clearing any previous interval
    setIsAnalyzing(true);
    setIsLoading(true);
    isAnalyzingRef.current = true; // Ensure ref is true


    // Perform initial analysis immediately
    await performAnalysis();

    // Check if analysis wasn't stopped due to an error during the first run (using ref)
    if (isAnalyzingRef.current) {
        setIsLoading(false); // Set loading false *after* the first successful/attempted analysis
        // Set up interval only if the first analysis didn't fail and stop analysis
        analysisIntervalRef.current = setInterval(performAnalysis, ANALYSIS_INTERVAL);
        console.log("Analysis interval started.");
    } else {
        // If analysis was stopped during the first attempt (e.g., error), ensure loading is false.
         setIsLoading(false);
         console.log("Analysis was stopped during initial run, interval not started.");
    }

  }, [selectedExercise, isCameraReady, isCameraOn, hasCameraPermission, toast, stopAnalysis, error ]); // Dependencies

   // Effect to sync the ref when the isAnalyzing state changes
   useEffect(() => {
       isAnalyzingRef.current = isAnalyzing;
       // If analysis is stopped externally (isAnalyzing becomes false), ensure ref is updated
       // and interval is cleared if it hasn't been already (safety net)
       if (!isAnalyzing && analysisIntervalRef.current) {
           console.log("External stop detected via useEffect, ensuring interval cleanup.");
           stopAnalysis(); // Use stopAnalysis to handle cleanup consistently
       }
   }, [isAnalyzing, stopAnalysis]); // Add stopAnalysis dependency

  useEffect(() => {
    // Cleanup interval on component unmount
    return () => {
        isAnalyzingRef.current = false; // Mark as not analyzing
        stopAnalysis(); // Use stopAnalysis for cleanup
    };
  }, [stopAnalysis]); // Add stopAnalysis to dependency array

  // Recalculate if start button should be disabled
  // Needs exercise selected, camera ON, camera READY, permission GRANTED, and not already loading/analyzing.
  const isStartDisabled = !selectedExercise || !isCameraOn || !isCameraReady || hasCameraPermission !== true || isLoading || isAnalyzing ;


  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-secondary">
      <aside className="w-full md:w-1/4 bg-background p-6 shadow-md md:h-screen md:sticky md:top-0 flex flex-col">
        <h1 className="text-3xl font-bold text-primary mb-6 flex items-center">
          <Zap className="mr-2 text-accent" /> GymSight
        </h1>

        <div className="space-y-6 flex-grow flex flex-col">
          <div>
            <Label htmlFor="exercise-select" className="text-lg font-semibold mb-2 block">Select Exercise</Label>
            <Select
              value={selectedExercise}
              onValueChange={(value) => {
                 setSelectedExercise(value);
                 setFeedback(null); // Clear feedback when changing exercise
                 if (isAnalyzing) {
                    stopAnalysis(); // Stop analysis if exercise changes while running
                 }
              }}
              disabled={isAnalyzing || isLoading} // Disable select while analyzing/loading
            >
              <SelectTrigger id="exercise-select" className="w-full">
                <SelectValue placeholder="Choose an exercise..." />
              </SelectTrigger>
              <SelectContent>
                {EXERCISES.map((exercise) => (
                  <SelectItem key={exercise} value={exercise}>
                    {exercise}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
              onClick={handleCameraToggle}
              variant="outline"
              className="w-full"
              // Only disable the toggle button if permission is explicitly denied.
              // Allow clicking to turn on even if not ready (it will try to get ready).
              disabled={hasCameraPermission === false}
          >
              {isCameraOn ? <VideoOff className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />}
              {isCameraOn ? 'Turn Camera Off' : (hasCameraPermission === false ? 'Camera Disabled' : 'Turn Camera On')}
          </Button>

          {isAnalyzing ? (
            <Button onClick={stopAnalysis} variant="destructive" className="w-full">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stop Analysis
            </Button>
          ) : (
            <Button
              onClick={startAnalysis}
              disabled={isStartDisabled} // Use derived disabled state
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                 // Show Zap if ready to start, Ban if permission denied stops it
                 isStartDisabled && hasCameraPermission === false ? <Ban className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />
              )}
              {/* Adapt button text based on disabled reason */}
              {isLoading ? 'Initializing...' :
               isStartDisabled && hasCameraPermission === false ? 'Permission Denied' :
               isStartDisabled && !isCameraReady && isCameraOn ? 'Camera Not Ready' :
               isStartDisabled && !isCameraOn ? 'Camera Off' :
               isStartDisabled && !selectedExercise ? 'Select Exercise' :
               'Start Analysis'
              }
            </Button>
          )}

            {/* General Error Alert - Show if there's an error */}
            {/* Keep showing camera/permission errors even if trying to analyze */}
            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

           {/* Spacer to push content below to the bottom */}
           <div className="flex-grow"></div>

           {/* Informational Status (when no error, and not actively analyzing/loading first frame) */}
           {/* Only show these if there isn't a more specific error displayed above */}
           {!error && !isAnalyzing && !isLoading && (
             <>
               {/* Case 1: Camera explicitly denied */}
               {hasCameraPermission === false && (
                 <Alert variant="destructive" className="mt-auto mb-4">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Required</AlertTitle>
                    <AlertDescription>
                     Camera access denied. Please enable permissions in your browser settings.
                    </AlertDescription>
                 </Alert>
               )}
                {/* Case 2: Camera off (and permission not denied) */}
               {hasCameraPermission !== false && !isCameraOn && (
                 <Alert variant="default" className="mt-auto mb-4 border-primary/50">
                    <Video className="h-4 w-4 text-primary" />
                    <AlertTitle>Camera Off</AlertTitle>
                    <AlertDescription>
                     {hasCameraPermission === null ? 'Turn on the camera and grant permissions to begin.' : 'Turn on the camera to start.'}
                    </AlertDescription>
                 </Alert>
               )}
               {/* Case 3: Camera ON, Ready, Permission Granted, but no exercise selected */}
               {isCameraOn && isCameraReady && hasCameraPermission === true && !selectedExercise && (
                  <Alert variant="default" className="mt-auto mb-4 border-accent/50">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                     </svg>
                      <AlertTitle>Select Exercise</AlertTitle>
                      <AlertDescription>
                          Choose an exercise from the sidebar.
                      </AlertDescription>
                  </Alert>
               )}
               {/* Case 4: Camera ON, Permission Granted, but NOT ready yet */}
                {isCameraOn && !isCameraReady && hasCameraPermission === true && (
                   <Alert variant="default" className="mt-auto mb-4 border-yellow-500/50">
                      <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                       <AlertTitle>Camera Initializing</AlertTitle>
                       <AlertDescription>
                           Please wait, the camera is starting...
                       </AlertDescription>
                   </Alert>
                )}
             </>
           )}

        </div>
      </aside>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary">
              {/* More dynamic title */}
               {!isCameraOn ? 'Camera Feed (Off)' :
                hasCameraPermission === false ? 'Camera Feed (Permission Denied)' :
                hasCameraPermission === null ? 'Camera Feed (Waiting for Permission)' :
                !isCameraReady ? 'Camera Feed (Initializing)' :
                isAnalyzing ? `Analyzing: ${selectedExercise}` :
                selectedExercise ? `Ready for: ${selectedExercise}` :
                'Camera Feed (Select Exercise)'
               }
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
             <div className="w-full aspect-video bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
                 {/* CameraFeed handles its internal state display (errors, prompts) */}
                <CameraFeed
                  ref={cameraFeedRef}
                  onReady={handleCameraReady} // Pass the callback
                  isActive={isCameraOn}      // Control activation based on user toggle
                />
                {/* Loading overlay for *initial* analysis phase (when isLoading is true) */}
                {/* Show only if camera is on, ready, permission granted, and we are in the initial loading phase */}
                 {isCameraOn && isCameraReady && hasCameraPermission === true && isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-20 rounded-md">
                        <Loader2 className="h-12 w-12 animate-spin mb-2" />
                        <p>Initializing Analysis...</p>
                    </div>
                 )}
             </div>

            {/* Display feedback if available and analysis was successful (no current error) */}
            {feedback && !error && (
                 <FeedbackDisplay feedback={feedback} />
            )}

            {/* Status messages shown *during* analysis or when ready */}
             {isAnalyzing && !isLoading && !error && ( // Show when actively analyzing (after initial load) and no error
                 <Alert variant="default" className="w-full">
                     <Zap className="h-4 w-4 text-accent" />
                     <AlertTitle>Analysis Running</AlertTitle>
                     <AlertDescription>
                        Hold your position. Analyzing your {selectedExercise} form...
                        <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
                     </AlertDescription>
                 </Alert>
            )}
             {!isAnalyzing && !isLoading && !error && selectedExercise && isCameraOn && isCameraReady && hasCameraPermission === true && ( // Ready state
                 <Alert variant="default" className="w-full border-green-500/50">
                     <Zap className="h-4 w-4 text-green-600" />
                     <AlertTitle>Ready to Analyze</AlertTitle>
                     <AlertDescription>
                         Click "Start Analysis" when you're in position for {selectedExercise}.
                     </AlertDescription>
                 </Alert>
             )}
             {/* Note: Other states like 'Camera Off', 'Permission Denied', 'Select Exercise' are handled by alerts in the sidebar */}
          </CardContent>
        </Card>
      </main>
       <Toaster />
    </div>
  );
}
