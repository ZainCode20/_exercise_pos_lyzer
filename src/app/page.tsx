
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
import { Loader2, AlertCircle, Zap, Video, VideoOff } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);

  const cameraFeedRef = useRef<{ captureFrame: () => Promise<string | null> }>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const handleCameraReady = (ready: boolean) => {
    setIsCameraReady(ready);
    if (!ready) {
        setIsCameraOn(false); // Ensure camera state is off if not ready
        setError("Camera access denied or not available. Please check permissions and hardware.");
    } else {
        setError(null); // Clear previous errors if camera becomes ready
    }
  };

  const handleCameraToggle = () => {
    setIsCameraOn(prev => !prev);
    if (isCameraOn) {
        stopAnalysis(); // Stop analysis if camera is turned off
    }
  };


  const stopAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    setIsAnalyzing(false);
    setIsLoading(false);
    // Optionally clear feedback when stopping:
    // setFeedback(null);
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!selectedExercise || !isCameraReady || !isCameraOn) {
      toast({
        title: "Cannot Start Analysis",
        description: "Please select an exercise and ensure the camera is on and ready.",
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

    setError(null);
    setFeedback(null);
    setIsLoading(true);
    setIsAnalyzing(true);

    const performAnalysis = async () => {
        if (!cameraFeedRef.current) return;
        // Ensure analysis doesn't run if the component stopped analyzing in the meantime
        if (!analysisIntervalRef.current && !isLoading) return;

        try {
            const videoDataUri = await cameraFeedRef.current.captureFrame();
            console.log("Captured frame:", videoDataUri ? videoDataUri.substring(0, 50) + "..." : "null"); // Log start of data URI

            if (videoDataUri) {
                const result = await analyzeExerciseForm({
                    videoDataUri: videoDataUri,
                    exerciseType: selectedExercise,
                });
                console.log("AI Analysis Result:", result);
                setFeedback(result);
                setError(null);
            } else {
                 console.warn("Failed to capture frame.");
                 // Optionally set an error or keep previous feedback
            }
        } catch (err) {
            console.error('Error during analysis:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
            setError(errorMessage);
            setFeedback(null); // Clear feedback on error
             toast({
                title: "Analysis Error",
                description: errorMessage,
                variant: "destructive",
              });
            stopAnalysis(); // Stop analysis on error
        } finally {
           // No need to set loading false here if it's interval based
        }
    };

    // Perform initial analysis immediately
    await performAnalysis();
    setIsLoading(false); // Set loading false after first analysis

    // Then set up interval for subsequent analyses only if still analyzing
     if (analysisIntervalRef.current === null && isAnalyzing) { // Check isAnalyzing again
        analysisIntervalRef.current = setInterval(performAnalysis, ANALYSIS_INTERVAL);
     }


  }, [selectedExercise, isCameraReady, isCameraOn, toast, stopAnalysis, isAnalyzing, isLoading]);



  useEffect(() => {
    // Cleanup interval on component unmount or when stopAnalysis reference changes
    // This ensures the interval is cleared if the user navigates away or stops analysis
    return () => {
      stopAnalysis();
    };
  }, [stopAnalysis]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-secondary">
      <aside className="w-full md:w-1/4 bg-background p-6 shadow-md md:h-screen md:sticky md:top-0">
        <h1 className="text-3xl font-bold text-primary mb-6 flex items-center">
          <Zap className="mr-2 text-accent" /> GymSight
        </h1>

        <div className="space-y-6">
          <div>
            <Label htmlFor="exercise-select" className="text-lg font-semibold mb-2 block">Select Exercise</Label>
            <Select
              value={selectedExercise}
              onValueChange={(value) => {
                 setSelectedExercise(value);
                 // Reset feedback when exercise changes
                 setFeedback(null);
                 setError(null);
                 if (isAnalyzing) {
                    stopAnalysis(); // Stop analysis if exercise changes
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
              disabled={!isCameraReady && !isCameraOn} // Disable if camera is not ready, unless it's already on (to allow turning off)
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
              disabled={!selectedExercise || !isCameraReady || !isCameraOn || isLoading}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Initializing...' : 'Start Analysis'}
            </Button>
          )}

           {!isCameraReady && !isCameraOn && (
             <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Issue</AlertTitle>
                <AlertDescription>
                  Camera access might be denied or the device may not be available. Please check permissions.
                </AlertDescription>
              </Alert>
           )}

        </div>
      </aside>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary">
              {selectedExercise ? `Analyzing: ${selectedExercise}` : 'Camera Feed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
             <div className="w-full aspect-video bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
                <CameraFeed
                  ref={cameraFeedRef}
                  onReady={handleCameraReady}
                  isActive={isCameraOn}
                />
                {isCameraOn && isLoading && ( // Show loading indicator only during initial loading before analysis starts
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                        <Loader2 className="h-12 w-12 animate-spin mb-2" />
                        <p>Initializing Analysis...</p>
                    </div>
                )}
                {!isCameraOn && (
                     <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <VideoOff className="h-16 w-16 mb-4" />
                        <p className="text-lg">Camera is Off</p>
                        <p className="text-sm">Turn on the camera to start analysis.</p>
                    </div>
                )}
             </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {feedback && (
                 <FeedbackDisplay feedback={feedback} />
            )}
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
             {!isAnalyzing && !feedback && !error && selectedExercise && isCameraOn && !isLoading && (
                 <Alert variant="default" className="w-full">
                     <Zap className="h-4 w-4 text-accent" />
                     <AlertTitle>Ready to Analyze</AlertTitle>
                     <AlertDescription>
                         Click "Start Analysis" when you're in position.
                     </AlertDescription>
                 </Alert>
             )}
          </CardContent>
        </Card>
      </main>
       <Toaster />
    </div>
  );
}
