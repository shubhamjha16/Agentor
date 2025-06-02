// The directive tells the Next.js runtime to execute this code on the server.
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating follow-up questions based on an initial description of an AI agent's use case.
 *
 * - generateFollowUpQuestions - A function that takes a use case description and returns a list of follow-up questions.
 * - GenerateFollowUpQuestionsInput - The input type for the generateFollowUpQuestions function.
 * - GenerateFollowUpQuestionsOutput - The output type for the generateFollowUpQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the flow
const GenerateFollowUpQuestionsInputSchema = z.object({
  useCaseDescription: z
    .string()
    .describe('A description of the desired AI agent use case.'),
});
export type GenerateFollowUpQuestionsInput = z.infer<
  typeof GenerateFollowUpQuestionsInputSchema
>;

// Define the output schema for the flow
const GenerateFollowUpQuestionsOutputSchema = z.object({
  followUpQuestions: z
    .array(z.string())
    .describe('A list of follow-up questions to refine the agent design.'),
});
export type GenerateFollowUpQuestionsOutput = z.infer<
  typeof GenerateFollowUpQuestionsOutputSchema
>;

// Exported function to call the flow
export async function generateFollowUpQuestions(
  input: GenerateFollowUpQuestionsInput
): Promise<GenerateFollowUpQuestionsOutput> {
  return generateFollowUpQuestionsFlow(input);
}

// Define the prompt for generating follow-up questions
const generateFollowUpQuestionsPrompt = ai.definePrompt({
  name: 'generateFollowUpQuestionsPrompt',
  input: {schema: GenerateFollowUpQuestionsInputSchema},
  output: {schema: GenerateFollowUpQuestionsOutputSchema},
  prompt: `You are an AI assistant designed to help refine the design of AI agents. Based on the initial use case description provided by the user, generate a list of follow-up questions that will help gather more details and clarify the agent's requirements. The questions should be specific and aimed at understanding the agent's goals, processes, decision logic, and any relevant constraints.

Use Case Description: {{{useCaseDescription}}}

Follow-Up Questions:`,
});

// Define the Genkit flow
const generateFollowUpQuestionsFlow = ai.defineFlow(
  {
    name: 'generateFollowUpQuestionsFlow',
    inputSchema: GenerateFollowUpQuestionsInputSchema,
    outputSchema: GenerateFollowUpQuestionsOutputSchema,
  },
  async input => {
    const {output} = await generateFollowUpQuestionsPrompt(input);
    return output!;
  }
);
