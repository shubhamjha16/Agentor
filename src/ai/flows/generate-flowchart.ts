
// src/ai/flows/generate-flowchart.ts
'use server';

/**
 * @fileOverview Flow to generate a flowchart diagram from a user's textual description of an AI agent.
 *
 * - generateFlowchart - A function that generates the flowchart.
 * - GenerateFlowchartInput - The input type for the generateFlowchart function.
 * - GenerateFlowchartOutput - The return type for the generateFlowchart function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlowchartInputSchema = z.object({
  description: z
    .string()
    .describe('A textual description of the desired AI agent functionality.'),
  flowchartImage: z
    .string()
    .optional()
    .describe(
      "An optional hand-drawn flowchart as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateFlowchartInput = z.infer<typeof GenerateFlowchartInputSchema>;

const GenerateFlowchartOutputSchema = z.object({
  flowchartDiagram: z
    .string()
    .describe('A textual representation of the flowchart diagram.'),
});
export type GenerateFlowchartOutput = z.infer<typeof GenerateFlowchartOutputSchema>;

export async function generateFlowchart(input: GenerateFlowchartInput): Promise<GenerateFlowchartOutput> {
  return generateFlowchartFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlowchartPrompt',
  input: {schema: GenerateFlowchartInputSchema},
  output: {schema: GenerateFlowchartOutputSchema},
  prompt: `You are an expert AI agent flowchart designer.

You will generate a textual representation of a flowchart diagram based on the user's description of the AI agent's desired functionality.

Description: {{{description}}}

{{#if flowchartImage}}
Here is a hand-drawn flowchart provided by the user:
{{media url=flowchartImage}}
{{/if}}

Generate a textual representation of the flowchart diagram:
`,
});

const generateFlowchartFlow = ai.defineFlow(
  {
    name: 'generateFlowchartFlow',
    inputSchema: GenerateFlowchartInputSchema,
    outputSchema: GenerateFlowchartOutputSchema,
  },
  async (input): Promise<GenerateFlowchartOutput> => {
    try {
      const { output } = await prompt(input);

      if (!output) {
        console.error('Flowchart generation: Model returned undefined output.');
        throw new Error('The AI model did not return the expected output for the flowchart. Please check your input or try again.');
      }
      return output;
    } catch (e: unknown) {
      let userFriendlyErrorMessage = 'An unexpected error occurred while generating the flowchart. Please try again.';
      if (e instanceof Error) {
        console.error(`Error in generateFlowchartFlow: ${e.message}`, e);
        if (e.message.includes('503 Service Unavailable') || e.message.includes('model is overloaded') || e.message.includes('overloaded')) {
          userFriendlyErrorMessage = 'The AI model is currently overloaded. Please try again in a few moments.';
        } else if (e.message.includes('API key not valid')) {
          userFriendlyErrorMessage = 'The AI API key is not valid. Please check your configuration.';
        } else {
          // Keep a somewhat generic message for other errors but include original if it's not too technical
          userFriendlyErrorMessage = `Flowchart generation failed. If this persists, please check the console for more details.`;
        }
      } else {
        console.error('Unknown error in generateFlowchartFlow:', e);
      }
      throw new Error(userFriendlyErrorMessage);
    }
  }
);

