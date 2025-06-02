
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

  const stepTitles = ["Define Agent", "Review Flowchart & Export"];

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
      toast({ variant: "destructive", title: "Missing Description", description: "Please provide a use case description first."});
      return;
    }
    setError(null);
    setIsLoadingFlowchart(true);
    setGeneratedFlowchartText(""); // Clear previous flowchart

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
      toast({ title: "Flowchart Generated!", description: "You can now review and edit the flowchart." });
      navigateToStep(2); 
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
      const escapedValue = String(value).replace(/'/g, "\\'").replace(/\n/g, "\\n");
      mcqAnswersPythonDict += `'${key}': '${escapedValue}'`;
      if (index < mcqEntries.length - 1) {
        mcqAnswersPythonDict += ", ";
      }
    });
    mcqAnswersPythonDict += "}";
    if (mcqEntries.length === 0) mcqAnswersPythonDict = "{}";

    const safeUseCaseDescription = useCaseDescription.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const safeGeneratedFlowchartText = generatedFlowchartText.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"').replace(/\n/g, '\\n');

    const agentDefinitionText = `
# Agentor AI Agent Definition (LangGraph Python Conceptual Structure)
# Generated on: ${new Date().toISOString()}

# == Use Case Description ==
"""
${safeUseCaseDescription}
"""

# == MCQ Answers (Refinements) ==
# ${mcqAnswersPythonDict}

# == Flowchart Definition (e.g., Mermaid Syntax or other textual format) ==
"""
${safeGeneratedFlowchartText}
"""

# --- LangGraph Python Implementation Blueprint ---
# This section provides a Python blueprint for structuring the agent
# using LangGraph. It includes conceptual examples for parsing the flowchart,
# defining conditional logic, and integrating LangChain tools.
# To make this runnable, you'll need to:
# 1. Implement the flowchart parsing logic.
# 2. Define actual node functions based on your flowchart.
# 3. Implement any required LangChain tools.
# 4. Potentially adjust state and routing based on specific needs.

from typing import TypedDict, Optional, Dict, Any, List, Literal
from langgraph.graph import StateGraph, END
# from langchain_core.messages import BaseMessage, HumanMessage, AIMessage # If using conversational memory
# from langchain_core.tools import tool # For defining LangChain tools
# from langchain_openai import ChatOpenAI # Example LLM for tools or agent steps

print("--- Conceptual LangGraph Agent Definition ---")

# 1. Define Agent State
class AgentState(TypedDict):
    useCaseDescription: str
    mcqAnswers: Dict[str, str]
    flowchartLogic: str # The textual flowchart
    userInput: Optional[str] # Example: for interactive agents
    parsedFlowchart: Optional[Dict[str, Any]] # For storing structured flowchart
    agentScratchpad: str # For intermediate thoughts/results
    intermediateResults: Dict[str, Any] # Store outputs from tools or steps
    finalResponse: Optional[str]
    # Add other state variables as needed based on your flowchart (e.g., conversation_history: List[BaseMessage])
    # e.g., current_node_id: Optional[str] # To track progress through the flowchart

# 2. Define Flowchart Parsing Logic (Conceptual)
def parse_flowchart_to_nodes_and_edges(flowchart_text: str) -> Dict[str, Any]:
    """
    Parses the textual flowchart into a structured representation.
    This is a CRITICAL and COMPLEX step. The implementation will heavily depend
    on the format of 'flowchart_text' (e.g., Mermaid, custom DSL).
    You might use regex, a dedicated parsing library, or even an LLM call for this.

    Output should ideally be a dictionary or list of objects representing:
    - Nodes: their ID, type (e.g., 'start', 'decision', 'action', 'end'), content/prompt.
    - Edges: source node ID, target node ID, condition (for decision nodes).
    """
    print(f"Attempting to parse flowchart: {flowchart_text[:100]}...")
    # Placeholder: In a real scenario, this would involve significant logic.
    # Example conceptual output structure:
    # {
    #   "nodes": [
    #     {"id": "start", "type": "start_node", "next": "user_intent_analysis"},
    #     {"id": "user_intent_analysis", "type": "llm_call_node", "prompt_template": "Analyze user: {{{userInput}}}", "next": "decision_is_product_query"},
    #     {"id": "decision_is_product_query", "type": "conditional_node", "condition_logic_key": "is_product_query"}, # Points to a key in intermediateResults
    #     # ... more nodes
    #   ],
    #   "edges": [
    #     {"from": "decision_is_product_query", "to": "product_lookup_node", "condition_value": "yes"},
    #     {"from": "decision_is_product_query", "to": "general_query_node", "condition_value": "no"},
    #     # ... more edges
    #   ],
    #   "entry_point": "start"
    # }
    # For now, returning a dummy structure.
    parsed_structure = {"nodes": [], "edges": [], "entry_point": "entry_node_placeholder"} # Replace with actual parsing
    print("Flowchart parsing placeholder executed.")
    return parsed_structure

# 3. Define LangChain Tools (Conceptual - if needed)
# @tool
# def knowledge_base_lookup_tool(query: str) -> str:
#     \"\"\"Looks up information in the knowledge base based on the query.\"\"\"
#     print(f"--- Tool: knowledge_base_lookup_tool called with query: {query} ---")
#     # Placeholder: Implement actual KB lookup logic here
#     if "product A" in query.lower():
#         return "Product A is a high-performance gadget with features X, Y, Z."
#     return "Sorry, I couldn't find specific information for that query in the KB."

# llm_for_tools = ChatOpenAI(model="gpt-3.5-turbo") # Example LLM
# tools = [knowledge_base_lookup_tool]
# llm_with_tools = llm_for_tools.bind_tools(tools)


# 4. Define Nodes (as Python functions)
#    Each node takes the current state (AgentState) and returns a dictionary to update the state.
#    Ideally, many of these nodes would be dynamically generated or selected based on 'parsedFlowchart'.

def entry_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Entry ---")
    print(f"Initializing agent with Use Case: {state['useCaseDescription'][:100]}...")
    parsed_flowchart = parse_flowchart_to_nodes_and_edges(state['flowchartLogic'])
    
    # The 'parsedFlowchart' would then guide which node to go to next,
    # or what initial actions to take.
    updated_scratchpad = "Agent initialized. Flowchart parsed (conceptually). Ready to process."
    # Example: if the agent is conversational
    # if not state.get('conversation_history'):
    # updated_scratchpad += "\\nNo conversation history yet."
    return {
        "agentScratchpad": state.get("agentScratchpad","") + "\\n" + updated_scratchpad, 
        "parsedFlowchart": parsed_flowchart,
        "intermediateResults": state.get("intermediateResults", {}) # Ensure it exists
    }

# Example of a generic processing node. In reality, you'd have specific nodes
# for different actions in your flowchart (e.g., 'ask_clarifying_question', 'call_tool_X', 'generate_response').
def process_flowchart_step_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Process Flowchart Step (Generic) ---")
    # This is where the core logic based on the *parsed* flowchart would reside.
    # - Identify current step in 'parsedFlowchart' (perhaps using 'current_node_id' in state).
    # - Execute action for that step (e.g., call an LLM, use a tool, update state).
    # - Update 'agentScratchpad' and 'intermediateResults'.
    
    current_input = state.get('userInput', '')
    scratchpad = state.get('agentScratchpad', '')
    
    # --- Placeholder Logic ---
    print(f"Interpreting parsed flowchart (conceptual): {str(state.get('parsedFlowchart', {}))[:100]}...")
    print(f"Considering user input: {current_input[:70]}...")

    agent_response_text = "Processing step based on flowchart logic..."
    if "customer support" in state['useCaseDescription'].lower():
        agent_response_text = "Based on the flowchart, I should provide customer support steps. (Conceptual: actual steps would be derived from parsed flowchart)"
        # Example: if a tool was needed:
        # tool_call_result = knowledge_base_lookup_tool.invoke({"query": "product A issue"})
        # agent_response_text += f" KB Result: {tool_call_result}"
        # state['intermediateResults']['kb_lookup'] = tool_call_result
    elif "product recommendation" in state['useCaseDescription'].lower():
        agent_response_text = "According to the flowchart, I will recommend a product. (Conceptual)"
    
    updated_scratchpad = scratchpad + f"\\nFlowchart step processed: {agent_response_text}"
    # This node might set a specific key in intermediateResults that a conditional edge can check.
    # e.g., state['intermediateResults']['next_step_condition'] = 'needs_more_info'
    return {"agentScratchpad": updated_scratchpad, "finalResponse": agent_response_text, "intermediateResults": state.get("intermediateResults", {})}

def final_output_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Final Output ---")
    response = state.get('finalResponse', "No specific response was generated by the agent.")
    print(f"Agent's Final Response: {response}")
    return {"finalResponse": response} 

# 5. Define Router/Conditional Logic (More Concrete Example)
def decide_next_step_router(state: AgentState) -> Literal["path_A", "path_B", "__end__"]:
    """
    Example router function for conditional edges.
    Inspects the state to decide the next node or if the process should end.
    """
    print("--- Router: decide_next_step_router ---")
    scratchpad = state.get("agentScratchpad", "").lower()
    intermediate_results = state.get("intermediateResults", {})

    # This logic is highly dependent on your specific flowchart and state updates.
    if "some_condition_for_path_a" in scratchpad or intermediate_results.get("some_key") == "value_for_A":
        print("Routing to Path A")
        return "path_A" # Name of the next node for Path A
    elif "some_condition_for_path_b" in scratchpad:
        print("Routing to Path B")
        return "path_B" # Name of the next node for Path B
    else:
        print("Routing to END")
        return "__end__" # Special keyword to end the graph

# Placeholder nodes for the router example
def path_a_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Path A ---")
    return {"agentScratchpad": state.get("agentScratchpad","") + "\\nExecuted Path A"}

def path_b_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Path B ---")
    return {"agentScratchpad": state.get("agentScratchpad","") + "\\nExecuted Path B"}

# 6. Assemble the Graph
print("--- Assembling LangGraph ---")
builder = StateGraph(AgentState)

# Add nodes to the graph
# These would ideally be added based on the 'parsedFlowchart'
builder.add_node("entry", entry_node)
builder.add_node("process_step", process_flowchart_step_node) 
# For the conditional example:
builder.add_node("path_A_handler", path_a_node)
builder.add_node("path_B_handler", path_b_node)
builder.add_node("final_output", final_output_node)

# Set the entry point for the graph
# This could also be dynamically set from 'parsedFlowchart.entry_point'
builder.set_entry_point("entry")

# Add edges to define the flow between nodes
# Static edges:
builder.add_edge("entry", "process_step")

# Conditional Edges:
# The 'process_step' node would need to set some state that 'decide_next_step_router' can check.
builder.add_conditional_edges(
    "process_step", # Source node
    decide_next_step_router, # Router function
    { # Mapping of router's return value to next node name
        "path_A": "path_A_handler",
        "path_B": "path_B_handler",
        "__end__": "final_output" # Using final_output before END for clarity
    }
)
builder.add_edge("path_A_handler", "final_output")
builder.add_edge("path_B_handler", "final_output")

# Define the end point of the graph
builder.add_edge("final_output", END)

# 7. Compile the Graph
print("--- Compiling Graph ---")
try:
    agent_executor = builder.compile()
    print("Graph compiled successfully.")

    # 8. Invoke the Graph (Example)
    print("--- Example Invocation ---")
    initial_state_input = {
        "useCaseDescription": """${safeUseCaseDescription}""",
        "mcqAnswers": ${mcqAnswersPythonDict},
        "flowchartLogic": """${safeGeneratedFlowchartText}""",
        "userInput": "Hello, I need help with my recent order about Product A.", # Example user input
        "agentScratchpad": "", # Initial scratchpad
        "intermediateResults": {}, # Initial intermediate results
        "finalResponse": None,
        # "conversation_history": [] # Initialize if using conversational memory
    }

    print("\\nStreaming agent execution (conceptual)...")
    # for event_step in agent_executor.stream(initial_state_input):
    #     node_name = list(event_step.keys())[0]
    #     current_state_at_node = event_step[node_name]
    #     print(f"\\nOutput from node '{node_name}':")
    #     print("Current State:", current_state_at_node)
    #     print("--------------------------------------")
    
    final_state_output = agent_executor.invoke(initial_state_input)
    print("\\nFinal Agent State after invocation:", final_state_output)
    print("Final Response:", final_state_output.get('finalResponse'))

except Exception as e:
    print(f"Error during graph compilation or example invocation: {e}")

print("--- End of Conceptual LangGraph Agent Definition ---")

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
    if (step === 2 && !generatedFlowchartText.trim()) {
        toast({ variant: "destructive", title: "Flowchart Not Generated", description: "Please generate the flowchart in Step 1 first."});
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
        <StepIndicator currentStep={currentStep} totalSteps={2} stepTitles={stepTitles} />

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
                <CardTitle className="font-headline text-2xl">Define Your AI Agent</CardTitle>
              </div>
              <CardDescription>
                Describe your agent, answer clarifying questions, and optionally provide a hand-drawn flowchart to guide the AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="useCaseDescription" className="text-base font-medium">Use Case Description</Label>
                <Textarea
                  id="useCaseDescription"
                  value={useCaseDescription}
                  onChange={(e) => setUseCaseDescription(e.target.value)}
                  placeholder="e.g., 'An AI agent to help customers troubleshoot product issues...'"
                  rows={6}
                  className="mt-1 text-base"
                />
              </div>
              
              <Button 
                onClick={handleGetFollowUpQuestions} 
                disabled={isLoadingQuestions || !useCaseDescription.trim()} 
                className="w-full sm:w-auto text-base py-3 px-6"
              >
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

              <div className="space-y-2 pt-4 border-t">
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
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleGenerateFlowchart} 
                disabled={isLoadingFlowchart || !useCaseDescription.trim()} 
                className="ml-auto text-base py-3 px-6"
              >
                {isLoadingFlowchart ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ScanText className="mr-2 h-5 w-5" />}
                Generate Flowchart & Proceed
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 2 && (
          <Card className="w-full max-w-3xl mx-auto shadow-lg">
            <CardHeader>
              <div className="flex items-center mb-2">
                 <DownloadCloud className="h-7 w-7 mr-3 text-primary" />
                <CardTitle className="font-headline text-2xl">Review Flowchart & Export Agent</CardTitle>
              </div>
              <CardDescription>
                Review and edit the generated flowchart text. Then, download your AI agent's definition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div>
                <h4 className="font-semibold text-lg mb-1">Base Use Case Description:</h4>
                <p className="text-muted-foreground p-3 border rounded-md bg-secondary/30 whitespace-pre-wrap">{useCaseDescription || "No description provided."}</p>
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
              
              {flowchartImagePreview && (
                <div className="mt-4">
                  <h4 className="font-semibold text-lg mb-1">Uploaded Hand-Drawn Flowchart:</h4>
                  <div className="relative group w-full max-w-md border rounded-md p-2 bg-secondary/30">
                    <Image src={flowchartImagePreview} alt="Flowchart preview" width={400} height={300} className="rounded-md object-contain max-h-[300px] w-auto mx-auto" data-ai-hint="diagram drawing" />
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <Label htmlFor="generatedFlowchart" className="text-base font-medium">Generated Flowchart (Editable)</Label>
                <Textarea
                  id="generatedFlowchart"
                  value={generatedFlowchartText}
                  onChange={(e) => setGeneratedFlowchartText(e.target.value)}
                  rows={12}
                  className="mt-1 font-code text-sm bg-input/30"
                  placeholder="Flowchart will appear here in a textual format..."
                />
                 <Alert className="mt-2">
                  <Check className="h-4 w-4"/>
                  <AlertTitle>Review and Edit</AlertTitle>
                  <AlertDescription>
                    You can edit the textual representation of the flowchart above. 
                    This text will be used to generate your agent definition.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigateToStep(1)} className="text-base py-3 px-6">Back to Define</Button>
              <Button 
                onClick={handleExportAgent} 
                disabled={!generatedFlowchartText.trim()}
                className="text-base py-3 px-6"
              >
                <DownloadCloud className="mr-2 h-5 w-5" />
                Download Agent Definition
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

