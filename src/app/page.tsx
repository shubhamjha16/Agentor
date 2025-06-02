
"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import Image from "next/image";
import { generateFollowUpQuestions, type GenerateFollowUpQuestionsInput, type GenerateFollowUpQuestionsOutput } from "@/ai/flows/generate-follow-up-questions";
import { generateFlowchart, type GenerateFlowchartInput } from "@/ai/flows/generate-flowchart";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, ScanText, DownloadCloud, AlertTriangle, Check, FileImage, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MCQ {
  questionText: string;
  options: string[];
  questionCategory?: string;
}

export default function AgentorPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [useCaseDescription, setUseCaseDescription] = useState("");
  const [followUpQuestions, setFollowUpQuestions] = useState<MCQ[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, string>>({});
  const [flowchartImageFile, setFlowchartImageFile] = useState<File | null>(null);
  const [flowchartImageDataUri, setFlowchartImageDataUri] = useState<string | null>(null);
  const [flowchartImagePreview, setFlowchartImagePreview] = useState<string | null>(null);
  const [generatedFlowchartText, setGeneratedFlowchartText] = useState("");
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isLoadingFlowchart, setIsLoadingFlowchart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const stepTitles = ["Describe Use Case", "Generate Flowchart", "Export Agent"];

  useEffect(() => {
    if (flowchartImageFile) {
      const readerPreview = new FileReader();
      readerPreview.onloadend = () => {
        setFlowchartImagePreview(readerPreview.result as string);
      };
      readerPreview.readAsDataURL(flowchartImageFile);

      const readerDataUri = new FileReader();
      readerDataUri.onloadend = () => {
        setFlowchartImageDataUri(readerDataUri.result as string);
      }
      readerDataUri.readAsDataURL(flowchartImageFile);

    } else {
      setFlowchartImagePreview(null);
      setFlowchartImageDataUri(null);
    }
  }, [flowchartImageFile]);

  const handleGetFollowUpQuestions = async () => {
    if (!useCaseDescription.trim()) {
      setError("Please describe your use case first.");
      return;
    }
    setError(null);
    setIsLoadingQuestions(true);
    setFollowUpQuestions([]);
    setMcqAnswers({});
    try {
      const input: GenerateFollowUpQuestionsInput = { useCaseDescription };
      const result = await generateFollowUpQuestions(input);
      setFollowUpQuestions(result.followUpQuestions || []);
      if (!result.followUpQuestions || result.followUpQuestions.length === 0) {
        toast({ title: "No specific follow-up questions generated.", description: "Your description might be clear enough or very brief. You can proceed to flowchart generation." });
      }
    } catch (e) {
      console.error("Error generating follow-up questions:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Question Generation Failed", description: errorMessage });
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleMcqAnswerChange = (questionIndex: number, selectedOption: string) => {
    setMcqAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionIndex]: selectedOption,
    }));
  };

  const handleGenerateFlowchart = async () => {
    if (!useCaseDescription.trim()) {
      setError("Please ensure the use case description is provided.");
      return;
    }
    setError(null);
    setIsLoadingFlowchart(true);
    setGeneratedFlowchartText("");

    let fullDescription = useCaseDescription;
    if (followUpQuestions.length > 0 && Object.keys(mcqAnswers).length > 0) {
      let refinementText = "\n\nFurther refinement based on user's answers to clarifying questions:\n";
      let answeredCount = 0;
      followUpQuestions.forEach((mcq, index) => {
        if (mcqAnswers[index]) {
          refinementText += `Q: ${mcq.questionText}\nA: ${mcqAnswers[index]}\n`;
          answeredCount++;
        }
      });
      if(answeredCount > 0) {
        fullDescription += refinementText;
      }
    }

    try {
      const input: GenerateFlowchartInput = { description: fullDescription };
      if (flowchartImageDataUri) {
        input.flowchartImage = flowchartImageDataUri;
      }
      const result = await generateFlowchart(input);
      setGeneratedFlowchartText(result.flowchartDiagram);
      toast({ title: "Flowchart Generated!", description: "You can now review and edit the flowchart below." });
      navigateToStep(2.5); 
    } catch (e) {
      console.error("Error generating flowchart:", e); 
      const specificErrorMessage = e instanceof Error ? e.message : "An unknown error occurred while generating the flowchart.";
      setError(specificErrorMessage); 
      toast({ 
        variant: "destructive", 
        title: "Flowchart Generation Failed", 
        description: specificErrorMessage 
      });
    } finally {
      setIsLoadingFlowchart(false);
    }
  };
  
  const handleExportAgent = () => {
    if (!generatedFlowchartText) return;

    let mcqAnswersPythonDict = "{";
    const mcqEntries = Object.entries(mcqAnswers);
    mcqEntries.forEach(([key, value], index) => {
      mcqAnswersPythonDict += `'${key}': '${String(value).replace(/'/g, "\\'")}'`;
      if (index < mcqEntries.length - 1) {
        mcqAnswersPythonDict += ", ";
      }
    });
    mcqAnswersPythonDict += "}";
    if (mcqEntries.length === 0) mcqAnswersPythonDict = "{}";

    const safeUseCaseDescription = useCaseDescription.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"');
    const safeGeneratedFlowchartText = generatedFlowchartText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"');

    const agentDefinitionText = `
# Agentor AI Agent Definition (LangGraph Python Conceptual Structure)
# Generated on: ${new Date().toISOString()}

# == Use Case Description ==
"""
${useCaseDescription}
"""

# == MCQ Answers (Refinements) ==
# ${mcqAnswersPythonDict}

# == Flowchart Definition (e.g., Mermaid Syntax or other textual format) ==
"""
${generatedFlowchartText}
"""

# --- LangGraph Python Conceptual Structure ---
# This section provides a conceptual Python outline for structuring the agent
# using LangGraph principles. This is for illustrative purposes and may require
# further development and integration with LangGraph libraries to be executable.

# from typing import TypedDict, Optional, Dict, Any, List
# from langgraph.graph import StateGraph, END # Assuming these imports for a real LangGraph setup
# # You might also need: from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

# print("--- Conceptual LangGraph Agent Definition ---")

# 1. Define Agent State
# class AgentState(TypedDict):
#     useCaseDescription: str
#     mcqAnswers: Dict[str, str]
#     flowchartLogic: str # This would be your textual flowchart
#     userInput: Optional[str] # Example: for interactive agents
#     agentScratchpad: str # For intermediate thoughts/results
#     intermediateResults: Optional[Dict[str, Any]]
#     finalResponse: Optional[str]
#     # Add other state variables as needed based on your flowchart (e.g., conversation_history: List[BaseMessage])

# 2. Define Nodes (as Python functions)
#    Each node takes the current state (AgentState) and returns a dictionary to update the state.

# def entry_node(state: AgentState) -> Dict[str, Any]:
#     print("--- Node: Entry ---")
#     # This node could initialize the agent, load prerequisite data, or greet the user.
#     # The useCaseDescription, mcqAnswers, and flowchartLogic are typically loaded
#     # into the initial state when the graph is invoked.
#     print(f"Initializing agent with Use Case: {state['useCaseDescription'][:100]}...")
#     print(f"MCQ Answers for refinement: {state['mcqAnswers']}")
#     print(f"Flowchart structure to follow: {state['flowchartLogic'][:100]}...")
#     
#     updated_scratchpad = "Agent initialized. Ready to process flowchart logic based on user input or predefined triggers."
#     # Example: If the agent is conversational
#     # if not state.get('conversation_history'):
#     # updated_scratchpad += "\\nNo conversation history yet."
#     return {"agentScratchpad": updated_scratchpad}

# def process_flowchart_node(state: AgentState) -> Dict[str, Any]:
#     print("--- Node: Process Flowchart ---")
#     flowchart_text = state['flowchartLogic']
#     current_input = state.get('userInput', '')
#     scratchpad = state.get('agentScratchpad', '')
#     
#     # Core logic based on your flowchart would reside here.
#     # This involves:
#     #   - Parsing/interpreting 'flowchart_text'.
#     #   - Using 'mcqAnswers' for refined logic.
#     #   - Potentially using 'userInput' if the agent interacts.
#     #   - Making decisions, calling tools (external APIs, data lookups via LangChain tools).
#     #   - Updating 'agentScratchpad' with reasoning.
#     #   - Preparing 'intermediateResults' or 'finalResponse'.
#
#     # ---- Placeholder Logic ----
#     print(f"Interpreting flowchart: {flowchart_text[:70]}...")
#     print(f"Considering user input: {current_input[:70]}...")
#
#     # Example: Simple conditional logic based on flowchart hint
#     agent_response_text = ""
#     if "customer support" in state['useCaseDescription'].lower():
#         agent_response_text = "Based on the flowchart, I should provide customer support steps."
#     elif "product recommendation" in state['useCaseDescription'].lower():
#         agent_response_text = "According to the flowchart, I will recommend a product."
#     else:
#         agent_response_text = "Processing complete based on the general flowchart structure."
#     
#     # This is a placeholder for the actual outcome of flowchart processing.
#     # In a real agent, this node might route to different nodes based on its interpretation.
#     # For this example, we'll assume it directly leads to a final response.
#     updated_scratchpad = scratchpad + f"\\nFlowchart processing: {agent_response_text}"
#     return {"agentScratchpad": updated_scratchpad, "finalResponse": agent_response_text}

# def final_output_node(state: AgentState) -> Dict[str, Any]:
#     print("--- Node: Final Output ---")
#     response = state.get('finalResponse', "No specific response was generated by the agent.")
#     print(f"Agent's Final Response: {response}")
#     # This node typically signifies the end of a particular path or the entire agent's run.
#     # No further state updates are strictly necessary if this is leading to END.
#     return {"finalResponse": response} # Or just {} if no change to finalResponse needed here

# 3. Assemble the Graph
# print("--- Assembling LangGraph ---")
# builder = StateGraph(AgentState)

# Add nodes to the graph
# builder.add_node("entry", entry_node)
# builder.add_node("process_flowchart", process_flowchart_node)
# builder.add_node("final_output", final_output_node)
# # Add more nodes here as per your flowchart (e.g., decision_nodes, tool_calling_nodes)

# Set the entry point for the graph
# builder.set_entry_point("entry")

# Add edges to define the flow between nodes
# builder.add_edge("entry", "process_flowchart")

# Example of a conditional edge (conceptual):
# # def decide_next_step_after_processing(state: AgentState):
# #     # Logic to decide the next node based on 'intermediateResults' or 'agentScratchpad'
# #     if "specific_condition_met" in state.get('agentScratchpad', ''):
# #         return "custom_logic_node" # Name of another node
# #     elif state.get('intermediateResults', {}).get('tool_error'):
# #         return "error_handling_node"
# #     else:
# #         return "final_output" # Default path
#
# # builder.add_conditional_edges(
# #     "process_flowchart",
# #     decide_next_step_after_processing,
# #     {
# # "custom_logic_node": "custom_logic_node", # Map decision to node name
# # "error_handling_node": "error_handling_node",
# # "final_output": "final_output",
# #     }
# # )
# # builder.add_edge("custom_logic_node", "final_output") # Example
# # builder.add_edge("error_handling_node", "final_output") # Example

# For this simplified example structure, a direct edge:
# builder.add_edge("process_flowchart", "final_output")

# Define the end point of the graph
# builder.add_edge("final_output", END)

# Compile the graph (this creates a LangChain Runnable)
# print("--- Compiling Graph ---")
# try:
#     agent_executor = builder.compile()
#     print("Graph compiled successfully.")
#
#     # 4. Invoke the Graph (Example)
#     print("--- Example Invocation ---")
#     initial_state = {
#         "useCaseDescription": """${safeUseCaseDescription}""",
#         "mcqAnswers": ${mcqAnswersPythonDict},
#         "flowchartLogic": """${safeGeneratedFlowchartText}""",
#         "userInput": "Hello, I need help with my recent order.", # Example user input
#         "agentScratchpad": "",
#         "intermediateResults": {},
#         "finalResponse": None,
#         # "conversation_history": [] # Initialize if using conversational memory
#     }
#
#     # To stream events (including state at each step):
#     # print("\\nStreaming agent execution...")
#     # for event_step in agent_executor.stream(initial_state):
#     #     node_name = list(event_step.keys())[0]
#     #     current_state_at_node = event_step[node_name]
#     #     print(f"\\nOutput from node '{node_name}':")
#     #     print("Current State:", current_state_at_node)
#     #     print("--------------------------------------")
#     # 
#     # final_state = agent_executor.invoke(initial_state)
#     # print("\\nFinal Agent State after invocation:", final_state)
#     # print("Final Response:", final_state.get('finalResponse'))
#
# except Exception as e:
# print(f"Error during graph compilation or example invocation: {e}")

# print("--- End of Conceptual LangGraph Agent Definition ---")

# For more details on building with LangGraph, refer to the official LangGraph documentation.
# https://python.langchain.com/docs/langgraph
`.trim();

    const blob = new Blob([agentDefinitionText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agentor_ai_agent_definition.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Agent Definition Downloaded!", description: "Your AI agent's conceptual Python LangGraph definition has been downloaded." });
  };

  const navigateToStep = (step: number) => {
    setError(null); 
    if (step === 2 && !useCaseDescription.trim()) {
        toast({ variant: "destructive", title: "Missing Description", description: "Please provide a use case description first."});
        return;
    }
     if (step === 3 && !generatedFlowchartText.trim()) {
        toast({ variant: "destructive", title: "Flowchart Not Confirmed", description: "Please generate and confirm the flowchart first."});
        return;
    }
    setCurrentStep(step);
  };

  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        toast({ variant: "destructive", title: "File too large", description: "Please upload an image smaller than 5MB." });
        return;
      }
      setFlowchartImageFile(file);
    }
  };

  const removeImage = () => {
    setFlowchartImageFile(null);
    setFlowchartImagePreview(null);
    setFlowchartImageDataUri(null);
    const fileInput = document.getElementById('flowchart-image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = ""; 
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8 md:px-6 md:py-12">
        <StepIndicator currentStep={Math.floor(currentStep)} totalSteps={3} stepTitles={stepTitles} />

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep === 1 && (
          <Card className="w-full max-w-2xl mx-auto shadow-lg">
            <CardHeader>
              <div className="flex items-center mb-2">
                <Brain className="h-7 w-7 mr-3 text-primary" />
                <CardTitle className="font-headline text-2xl">Describe Your AI Agent's Use Case</CardTitle>
              </div>
              <CardDescription>
                Explain in plain language what you want your AI agent to do. The more detail you provide, the better.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="useCaseDescription" className="text-base font-medium">Use Case Description</Label>
                <Textarea
                  id="useCaseDescription"
                  value={useCaseDescription}
                  onChange={(e) => setUseCaseDescription(e.target.value)}
                  placeholder="e.g., 'An AI agent to help customers troubleshoot product issues by asking questions and providing solutions from a knowledge base.'"
                  rows={6}
                  className="mt-1 text-base"
                />
              </div>
              <Button onClick={handleGetFollowUpQuestions} disabled={isLoadingQuestions || !useCaseDescription.trim()} className="w-full sm:w-auto text-base py-3 px-6">
                {isLoadingQuestions ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Get Follow-up Questions
              </Button>
              
              {followUpQuestions.length > 0 && (
                <div className="mt-6 space-y-6 p-4 border rounded-md bg-secondary/30">
                  <h3 className="font-semibold text-lg text-foreground">Refine with these questions:</h3>
                  {followUpQuestions.map((mcq, index) => (
                    <div key={index} className="mb-4 p-3 border-b border-border last:border-b-0 bg-card rounded-md shadow">
                       <Label className="font-medium text-base text-foreground/90 mb-2 block">
                        {mcq.questionCategory && (
                          <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm mr-2 align-middle">
                            {mcq.questionCategory}
                          </span>
                        )}
                        {mcq.questionText}
                      </Label>
                      <RadioGroup
                        value={mcqAnswers[index]}
                        onValueChange={(value) => handleMcqAnswerChange(index, value)}
                        className="space-y-2 pl-2"
                      >
                        {mcq.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`q${index}-option${optionIndex}`} />
                            <Label htmlFor={`q${index}-option${optionIndex}`} className="font-normal text-sm cursor-pointer">{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={() => navigateToStep(2)} disabled={!useCaseDescription.trim()} className="ml-auto text-base py-3 px-6">
                Next: Design Flowchart
              </Button>
            </CardFooter>
          </Card>
        )}

        {(currentStep === 2 || currentStep === 2.5) && (
          <Card className="w-full max-w-3xl mx-auto shadow-lg">
            <CardHeader>
              <div className="flex items-center mb-2">
                 <ScanText className="h-7 w-7 mr-3 text-primary" />
                <CardTitle className="font-headline text-2xl">Design Agent Flowchart</CardTitle>
              </div>
              <CardDescription>
                Review your description and any answered questions. Optionally, upload a hand-drawn flowchart. Then, generate the agent's logic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-1">Base Use Case Description:</h4>
                <p className="text-muted-foreground p-3 border rounded-md bg-secondary/30 whitespace-pre-wrap">{useCaseDescription || "No description provided yet."}</p>
              </div>
              
              {Object.keys(mcqAnswers).length > 0 && (
                <div>
                    <h4 className="font-semibold text-lg mb-1 mt-4">Your Answers to Follow-up Questions:</h4>
                    <div className="p-3 border rounded-md bg-secondary/30 space-y-2 max-h-60 overflow-y-auto">
                    {followUpQuestions.map((mcq, index) => 
                        mcqAnswers[index] ? (
                        <div key={`answer-${index}`} className="text-sm">
                            <p className="font-medium">{mcq.questionText}</p>
                            <p className="text-muted-foreground pl-2">↳ {mcqAnswers[index]}</p>
                        </div>
                        ) : null
                    )}
                    </div>
                </div>
                )}

              <div className="space-y-2">
                <Label htmlFor="flowchart-image-upload" className="text-base font-medium">Upload Hand-Drawn Flowchart (Optional)</Label>
                <Input id="flowchart-image-upload" type="file" accept="image/*" onChange={handleImageFileChange} className="text-base file:text-primary file:font-semibold"/>
                 {flowchartImagePreview && (
                  <div className="mt-4 relative group w-full max-w-md border rounded-md p-2 bg-secondary/30">
                    <Image src={flowchartImagePreview} alt="Flowchart preview" width={400} height={300} className="rounded-md object-contain max-h-[300px] w-auto mx-auto" data-ai-hint="diagram drawing" />
                    <Button variant="destructive" size="icon" onClick={removeImage} className="absolute top-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Button onClick={handleGenerateFlowchart} disabled={isLoadingFlowchart || !useCaseDescription.trim()} className="w-full sm:w-auto text-base py-3 px-6">
                {isLoadingFlowchart ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileImage className="mr-2 h-5 w-5" />}
                Generate Flowchart
              </Button>

              {currentStep === 2.5 && generatedFlowchartText && (
                <div className="mt-6 space-y-3">
                  <Label htmlFor="generatedFlowchart" className="text-base font-medium">Generated Flowchart (Editable)</Label>
                  <Textarea
                    id="generatedFlowchart"
                    value={generatedFlowchartText}
                    onChange={(e) => setGeneratedFlowchartText(e.target.value)}
                    rows={12}
                    className="mt-1 font-code text-sm bg-input/30"
                    placeholder="Flowchart will appear here in a textual format (e.g., Mermaid syntax)..."
                  />
                   <Alert className="mt-2">
                    <Check className="h-4 w-4"/>
                    <AlertTitle>Review and Edit</AlertTitle>
                    <AlertDescription>
                      You can edit the textual representation of the flowchart above. 
                      This text will be used to generate your agent.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigateToStep(1)} className="text-base py-3 px-6">Back</Button>
              <Button 
                onClick={() => navigateToStep(3)} 
                disabled={!generatedFlowchartText.trim() || currentStep !== 2.5}
                className="text-base py-3 px-6"
              >
                Next: Export Agent
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 3 && (
          <Card className="w-full max-w-2xl mx-auto shadow-lg">
            <CardHeader>
               <div className="flex items-center mb-2">
                <DownloadCloud className="h-7 w-7 mr-3 text-primary" />
                <CardTitle className="font-headline text-2xl">Export Your AI Agent</CardTitle>
              </div>
              <CardDescription>
                Your AI agent is ready! Download the generated textual definition with a Python LangGraph conceptual structure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-1">Confirmed Flowchart:</h4>
                <pre className="p-4 border rounded-md bg-secondary/30 max-h-80 overflow-auto text-sm font-code">{generatedFlowchartText || "No flowchart confirmed."}</pre>
              </div>
              <Button onClick={handleExportAgent} disabled={!generatedFlowchartText.trim()} className="w-full sm:w-auto text-base py-3 px-6">
                <DownloadCloud className="mr-2 h-5 w-5" />
                Download Agent Definition
              </Button>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigateToStep(2.5)} className="text-base py-3 px-6">Back</Button>
            </CardFooter>
          </Card>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

