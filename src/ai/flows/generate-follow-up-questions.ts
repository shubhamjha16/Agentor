
// The directive tells the Next.js runtime to execute this code on the server.
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating follow-up multiple-choice questions based on an initial description of an AI agent's use case.
 *
 * - generateFollowUpQuestions - A function that takes a use case description and returns a list of multiple-choice follow-up questions.
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

// Define the schema for a single MCQ option
const MCQOptionSchema = z.string().describe("A potential answer choice for the multiple-choice question.");

// Define the schema for a single MCQ
const MCQSchema = z.object({
  questionText: z.string().describe("The text of the multiple-choice question."),
  options: z.array(MCQOptionSchema).min(2).max(4).describe("A list of 2 to 4 options for the question."),
  questionCategory: z.string().optional().describe("An optional category for the question, e.g., 'Goals', 'Process', 'Data', 'Constraints'.")
});

// Define the output schema for the flow
const GenerateFollowUpQuestionsOutputSchema = z.object({
  followUpQuestions: z
    .array(MCQSchema)
    .describe('A list of multiple-choice follow-up questions to refine the agent design. Each question should have question text, 2-4 options, and an optional category.'),
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
  prompt: `You are an AI assistant designed to help refine the design of AI agents. Based on the initial use case description provided by the user, generate a list of multiple-choice follow-up questions. Each question should help gather more details and clarify the agent's requirements, goals, processes, decision logic, and any relevant constraints.

For each question:
1. Provide clear question text.
2. Provide 2 to 4 distinct answer options.
3. Optionally, assign a category to the question (e.g., 'Goals', 'Process', 'Data', 'Constraints', 'User Interaction', 'Error Handling').

Use Case Description: {{{useCaseDescription}}}

Follow-Up Questions (ensure the output strictly adheres to the defined schema, providing a list of objects, each with 'questionText', 'options' (an array of 2-4 strings), and optionally 'questionCategory'):`,
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
    // Ensure there's always an output, even if it's an empty list
    return output || { followUpQuestions: [] };
  }
);

