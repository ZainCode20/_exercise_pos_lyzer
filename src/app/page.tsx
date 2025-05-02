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
  const { toast } = useToast();

  // Define stopAnalysis first as other callbacks depend on it
  const stopAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
      console.log("Analysis interval cleared.");
    }
    // Check if component is still mounted or analysis is active before setting state
    if (isAnalyzing) setIsAnalyzing(false);
    if (isLoading) setIsLoading(false); // Ensure loading state is reset
    console.log("Analysis stopped.");
    // Do not clear general errors here, only feedback specific to analysis.
    // Keep camera errors displayed if they exist.
    // setFeedback(null); // Keep feedback displayed when stopping? Optional.
  }, [isAnalyzing, isLoading]); // Dependencies: isAnalyzing, isLoading

  // Define handleCameraReady next
  const handleCameraReady = useCallback((ready: boolean, permissionGranted: boolean | null, cameraError?: string | null) => {
    setIsCameraReady(ready);
    setHasCameraPermission(permissionGranted); // Update permission state

    if (!ready || permissionGranted === false) {
      setIsCameraOn(false); // Ensure camera state is off if not ready or permission denied
      const errorMessage = cameraError || (permissionGranted === false
        ? "Camera permission denied. Please allow camera access in browser settings."
        : "Camera not available. Check hardware or other apps using it.");
      setError(errorMessage); // Display the specific error
      stopAnalysis(); // Stop analysis if camera becomes not ready
    } else if (ready && permissionGranted === true) {
      setError(null); // Clear previous errors if camera becomes ready with permission
    }
    // If ready is true but permissionGranted is null, it means we are still waiting or haven't asked.
    // Don't clear error in this intermediate state.
  }, [stopAnalysis]); // Dependency: stopAnalysis


  const handleCameraToggle = () => {
    const turningOn = !isCameraOn;
    setIsCameraOn(turningOn);
    if (!turningOn) {
      stopAnalysis(); // Stop analysis if camera is manually turned off
      // Don't necessarily clear errors when turning off manually
    } else {
      // When turning on, clear previous *non-permission* errors
      // Keep permission errors if they exist
      if (hasCameraPermission !== false) {
        setError(null);
      }
      // Camera readiness and permission check will be handled by CameraFeed's onReady callback
    }
  };


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
     if (hasCameraPermission === false) {
        toast({
            title: "Permission Denied",
            description: error || "Camera permission is required. Please enable it in browser settings.",
            variant: "destructive",
        });
        return;
     }
    if (!isCameraReady || hasCameraPermission === null) { // Also check for null permission state
       toast({
        title: "Camera Not Ready",
        description: error || "The camera is initializing or not ready. Check permissions or hardware.",
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
    console.log("Starting analysis...");


    const performAnalysis = async () => {
        // Ensure analysis should still be running and camera is usable
        if (!analysisIntervalRef.current && !isLoading && !isAnalyzing) {
            console.log("Analysis stopped externally, skipping frame capture.");
            return;
        }
         if (!cameraFeedRef.current || !isCameraOn || !isCameraReady || hasCameraPermission !== true) {
            console.log("Camera became unavailable or permission lost, stopping analysis.");
            stopAnalysis();
            setError("Camera became unavailable or permission was revoked during analysis.");
            toast({
                title: "Camera Issue",
                description: "Camera became unavailable or permission was lost.",
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
                 // Only update state if analysis is still supposed to be running
                 // Check interval ref OR isLoading (for the very first analysis)
                 if (analysisIntervalRef.current || isLoading) {
                    setFeedback(result);
                    setError(null); // Clear previous analysis errors on success
                 }
            } else {
                 console.warn("Failed to capture frame. Skipping this analysis cycle.");
                 // Keep existing feedback or show a temporary message? For now, do nothing.
                 // Consider adding a toast notification here if it happens repeatedly.
            }
        } catch (err) {
            console.error('Error during AI analysis:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
             // Only update state if analysis is still supposed to be running
            if (analysisIntervalRef.current || isLoading) {
                setError(`AI Error: ${errorMessage}`); // Prefix AI errors
                setFeedback(null); // Clear feedback on error
                toast({
                    title: "Analysis Error",
                    description: errorMessage,
                    variant: "destructive",
                  });
                stopAnalysis(); // Stop analysis completely on AI error
            }
        } finally {
            // Only set loading to false AFTER the first analysis is done inside the interval setup
        }
    };

    // Stop any existing interval before starting a new one
    if (analysisIntervalRef.current) {
       clearInterval(analysisIntervalRef.current);
       analysisIntervalRef.current = null;
    }
    // Set analyzing true again after stopAnalysis might have been called implicitly if user changed exercise etc.
    setIsAnalyzing(true);
    setIsLoading(true); // Ensure loading is true


    // Perform initial analysis immediately
    await performAnalysis();

    // Check if analysis wasn't stopped due to an error during the first run
    // Use refs/state that reflect the current intention to analyze
    if (isAnalyzing) { // Re-check isAnalyzing state, might have been set to false by performAnalysis error
        setIsLoading(false);
        // Set up interval only if the first analysis didn't fail and stop analysis
        analysisIntervalRef.current = setInterval(performAnalysis, ANALYSIS_INTERVAL);
        console.log("Analysis interval started.");
    } else {
        // If analysis was stopped during the first attempt (e.g., error), ensure loading is false.
         setIsLoading(false);
         console.log("Analysis was stopped during initial run, interval not started.");
    }

  }, [selectedExercise, isCameraReady, isCameraOn, hasCameraPermission, toast, stopAnalysis, isAnalyzing, isLoading, error]); // Added hasCameraPermission



  useEffect(() => {
    // Cleanup interval on component unmount
    return () => {
      stopAnalysis(); // Use stopAnalysis for cleanup
    };
  }, [stopAnalysis]); // Add stopAnalysis to dependency array

  // Recalculate if start button should be disabled
  const isStartDisabled = !selectedExercise || !isCameraReady || !isCameraOn || isLoading || isAnalyzing || hasCameraPermission !== true;


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
                 // Don't clear general error, only analysis-specific state
                 if (isAnalyzing) {
                    stopAnalysis();
                 }
              }}
              disabled={isAnalyzing || isLoading}
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
              // Disable toggle if camera isn't ready *unless* it's currently on (to allow turning off)
              // Also disable if permission is denied.
              disabled={(!isCameraReady && !isCameraOn) || hasCameraPermission === false}
          >
              {isCameraOn ? <VideoOff className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />}
              {isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
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
                 hasCameraPermission === true ? <Zap className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" /> // Show Ban icon if no permission
              )}
              {isLoading ? 'Initializing...' : (hasCameraPermission === false ? 'Permission Denied' : 'Start Analysis')}
            </Button>
          )}

            {/* This alert now shows general errors, including camera/permission ones */}
            {error && !isLoading && !isAnalyzing && ( // Only show if not loading initial frame or actively analyzing
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

           {/* Spacer to push content below to the bottom */}
           <div className="flex-grow"></div>

           {/* Informational alert about camera status if no error and not analyzing */}
           {!error && !isAnalyzing && !isLoading && (
             <>
               {(hasCameraPermission === null && !isCameraOn) && (
                 <Alert variant="default" className="mt-auto mb-4 border-primary/50">
                    <Video className="h-4 w-4 text-primary" />
                    <AlertTitle>Camera Off</AlertTitle>
                    <AlertDescription>
                     Turn on the camera and grant permissions to begin.
                    </AlertDescription>
                 </Alert>
               )}
               {(hasCameraPermission === false) && (
                 <Alert variant="destructive" className="mt-auto mb-4">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Required</AlertTitle>
                    <AlertDescription>
                     Camera access denied. Please enable permissions in your browser settings.
                    </AlertDescription>
                 </Alert>
               )}
                {(hasCameraPermission === true && !isCameraOn) && (
                 <Alert variant="default" className="mt-auto mb-4 border-primary/50">
                    <Video className="h-4 w-4 text-primary" />
                    <AlertTitle>Camera Off</AlertTitle>
                    <AlertDescription>
                     Turn on the camera to start.
                    </AlertDescription>
                 </Alert>
               )}
               {/* Add case for Camera Ready but exercise not selected? Covered elsewhere */}
             </>
           )}

        </div>
      </aside>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary">
              {selectedExercise && isCameraOn && hasCameraPermission === true ? `Analyzing: ${selectedExercise}` : 'Camera Feed'}
              {isCameraOn && hasCameraPermission === false && ' (Permission Denied)'}
              {isCameraOn && hasCameraPermission === null && ' (Waiting for Permission)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
             <div className="w-full aspect-video bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
                 {/* CameraFeed will display its own internal errors/state/permission requests */}
                <CameraFeed
                  ref={cameraFeedRef}
                  onReady={handleCameraReady} // Pass the callback
                  isActive={isCameraOn}      // Control activation
                />
                {/* Loading overlay for initial analysis phase, only show if camera is ready and has permission */}
                 {isCameraOn && isCameraReady && hasCameraPermission === true && isLoading && !error && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-20">
                        <Loader2 className="h-12 w-12 animate-spin mb-2" />
                        <p>Initializing Analysis...</p>
                    </div>
                 )}
             </div>

            {/* Display feedback if available and analysis was successful */}
            {feedback && !error && (
                 <FeedbackDisplay feedback={feedback} />
            )}

            {/* Display status messages - more specific based on state */}
             {isAnalyzing && !feedback && !error && !isLoading && (
                 <Alert variant="default" className="w-full">
                     <Zap className="h-4 w-4 text-accent" />
                     <AlertTitle>Analysis Running</AlertTitle>
                     <AlertDescription>
                        Hold your position. Analyzing your form...
                        <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
                     </AlertDescription>
                 </Alert>
            )}
             {!isAnalyzing && !feedback && !error && selectedExercise && isCameraOn && hasCameraPermission === true && !isLoading && (
                 <Alert variant="default" className="w-full">
                     <Zap className="h-4 w-4 text-accent" />
                     <AlertTitle>Ready to Analyze</AlertTitle>
                     <AlertDescription>
                         Click "Start Analysis" when you're in position for {selectedExercise}.
                     </AlertDescription>
                 </Alert>
             )}
             {/* Message when camera is on but no exercise selected */}
              {!selectedExercise && isCameraOn && hasCameraPermission === true && !error && (
                 <Alert variant="default" className="w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                    </svg>
                     <AlertTitle>Select Exercise</AlertTitle>
                     <AlertDescription>
                         Choose an exercise from the sidebar to begin analysis.
                     </AlertDescription>
                 </Alert>
             )}
              {/* Message for permission denied shown in sidebar */}
          </CardContent>
        </Card>
      </main>
       <Toaster />
    </div>
  );
}
