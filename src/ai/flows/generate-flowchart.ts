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
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
