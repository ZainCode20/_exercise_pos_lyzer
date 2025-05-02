// This is an experimental implementation of real-time video analysis; it may not work as expected.
'use server';
/**
 * @fileOverview Analyzes exercise form in real-time and provides corrective guidance.
 *
 * - analyzeExerciseForm - Analyzes the user's exercise form and provides feedback.
 * - AnalyzeExerciseFormInput - The input type for the analyzeExerciseForm function.
 * - AnalyzeExerciseFormOutput - The return type for the analyzeExerciseForm function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeExerciseFormInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video of the user exercising, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  exerciseType: z.string().describe('The type of exercise being performed.'),
});
export type AnalyzeExerciseFormInput = z.infer<typeof AnalyzeExerciseFormInputSchema>;

const AnalyzeExerciseFormOutputSchema = z.object({
  formCorrect: z.boolean().describe('Whether the exercise form is correct.'),
  feedback: z.string().describe('Feedback on how to correct the exercise form.'),
});
export type AnalyzeExerciseFormOutput = z.infer<typeof AnalyzeExerciseFormOutputSchema>;

export async function analyzeExerciseForm(input: AnalyzeExerciseFormInput): Promise<AnalyzeExerciseFormOutput> {
  return analyzeExerciseFormFlow(input);
}

const analyzeExerciseFormPrompt = ai.definePrompt({
  name: 'analyzeExerciseFormPrompt',
  input: {
    schema: z.object({
      videoDataUri: z
        .string()
        .describe(
          "A video of the user exercising, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
      exerciseType: z.string().describe('The type of exercise being performed.'),
    }),
  },
  output: {
    schema: z.object({
      formCorrect: z.boolean().describe('Whether the exercise form is correct.'),
      feedback: z.string().describe('Feedback on how to correct the exercise form.'),
    }),
  },
  prompt: `You are a personal trainer who analyzes exercise form and provides feedback to the user.

You will be provided with a video of the user exercising and the type of exercise they are performing.

You must analyze the video and provide feedback on their form. If their form is correct, you must state that their form is correct.
If their form is incorrect, you must provide feedback on how to correct their form.

Exercise Type: {{{exerciseType}}}
Video: {{media url=videoDataUri}}
`,
});

const analyzeExerciseFormFlow = ai.defineFlow<
  typeof AnalyzeExerciseFormInputSchema,
  typeof AnalyzeExerciseFormOutputSchema
>({
  name: 'analyzeExerciseFormFlow',
  inputSchema: AnalyzeExerciseFormInputSchema,
  outputSchema: AnalyzeExerciseFormOutputSchema,
}, async input => {
  const {output} = await analyzeExerciseFormPrompt(input);
  return output!;
});
