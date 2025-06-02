
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
import { Loader2, Brain, ScanText, DownloadCloud, AlertTriangle, Check, FileImage, Trash2, ArrowRight } from "lucide-react";
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

  const stepTitles = ["Define Agent & Generate Flowchart", "Review & Export Agent"];

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
    // Do not clear generatedFlowchartText here, to allow re-generation if needed without losing previous version until success
    // setGeneratedFlowchartText(""); 

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
      toast({ title: "Flowchart Generated!", description: "Review and edit the flowchart below. Then proceed to the next step." });
      // navigateToStep(2); // Removed: User stays on Step 1 to review/edit
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
      mcqAnswersPythonDict += `'${followUpQuestions[parseInt(key)]?.questionText.replace(/'/g, "\\'").replace(/\n/g, "\\n") || `Question ${key}`}': '${escapedValue}'`;
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

import os # For API keys
from typing import TypedDict, Optional, Dict, Any, List, Literal
from langgraph.graph import StateGraph, END
# from langgraph.checkpoint.sqlite import SqliteSaver # Example for persistence
# from langchain_core.messages import BaseMessage, HumanMessage, AIMessage # If using conversational memory
from langchain_core.tools import tool 
from langchain_openai import ChatOpenAI # Example LLM for tools or agent steps

# Example: Load API keys from environment variables
# os.environ["OPENAI_API_KEY"] = "sk-your-openai-api-key"

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
    # conversation_history: List[BaseMessage] # Example if conversational memory is needed
    finalResponse: Optional[str]
    # e.g., current_node_id: Optional[str] # To track progress through the flowchart

# 2. Define Flowchart Parsing Logic (Conceptual)
def parse_flowchart_to_nodes_and_edges(flowchart_text: str) -> Dict[str, Any]:
    """
    Parses the textual flowchart (e.g., Mermaid syntax) into a structured representation.
    This is a CRITICAL and COMPLEX step. The implementation will heavily depend
    on the format of 'flowchart_text'.
    You might use regex, a dedicated parsing library (if one exists for the format), 
    or even an LLM call (e.g., to Gemini or GPT-4o) to convert the text to a JSON structure.

    Output should ideally be a dictionary or list of objects representing:
    - Nodes: their ID, type (e.g., 'start', 'decision', 'action', 'llm_call', 'tool_call', 'end'), 
             content/prompt, and any specific parameters.
    - Edges: source node ID, target node ID, condition (for decision nodes).
    """
    print(f"Attempting to parse flowchart: {flowchart_text[:150]}...")
    # Placeholder: In a real scenario, this would involve significant logic.
    # Example conceptual output structure if flowchart_text was Mermaid:
    # flowchart_text = "graph TD\\nA[Start] --> B{Is it a product query?}; B -- Yes --> C[Lookup Product]; B -- No --> D[General Query]"
    # parsed_structure = {
    #   "nodes": [
    #     {"id": "A", "label": "Start", "type": "start_node", "next_node": "B"},
    #     {"id": "B", "label": "Is it a product query?", "type": "conditional_node", "condition_key_in_state": "is_product_query"},
    #     {"id": "C", "label": "Lookup Product", "type": "tool_call_node", "tool_name": "product_lookup_tool"},
    #     {"id": "D", "label": "General Query", "type": "llm_call_node", "prompt_template": "Answer: {{{userInput}}}"}
    #   ],
    #   "edges": [
    #     {"from": "A", "to": "B"},
    #     {"from": "B", "to": "C", "condition_value": True}, # or "yes"
    #     {"from": "B", "to": "D", "condition_value": False} # or "no"
    #   ],
    #   "entry_point": "A" # The ID of the starting node
    # }
    # For now, returning a dummy structure. This needs to be implemented.
    parsed_structure = {
        "nodes": [{"id": "entry_node_placeholder", "type": "placeholder", "label":"Conceptual Entry"}], 
        "edges": [], 
        "entry_point": "entry_node_placeholder"
    }
    print("Flowchart parsing placeholder executed. Real implementation needed.")
    return parsed_structure

# 3. Define LangChain Tools (Conceptual - if needed)
#    Tools allow the agent to interact with external systems or perform specific actions.
#    Example: A tool to lookup product information from a knowledge base.

# @tool
# def product_lookup_tool(product_name: str) -> str:
#     \"\"\"Looks up information about a specific product in the knowledge base.\"\"\"
#     print(f"--- Tool: product_lookup_tool called for product: {product_name} ---")
#     # Placeholder: Implement actual KB lookup logic here.
#     # This could involve querying a database, an API, or a vector store.
#     if "widget pro" in product_name.lower():
#         return "Widget Pro: Features include A, B, C. Price: $99.99."
#     elif "gadget max" in product_name.lower():
#         return "Gadget Max: Advanced features X, Y, Z. Price: $149.00. Currently out of stock."
#     else:
#         return f"Sorry, no information found for product: {product_name}."

# Example LLM for tool execution (if tools themselves use an LLM or need an LLM for routing to tools)
# llm_for_tools = ChatOpenAI(model="gpt-3.5-turbo", temperature=0) 
# tools = [product_lookup_tool]
# llm_with_tools = llm_for_tools.bind_tools(tools) # Makes tools available to the LLM


# 4. Define Nodes (as Python functions)
#    Each node takes the current state (AgentState) and returns a dictionary to update the state.
#    Node functions would ideally be dynamically generated or selected based on 'parsedFlowchart'.

def entry_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Entry ---")
    print(f"Initializing agent with Use Case: {state['useCaseDescription'][:100]}...")
    
    # Actual parsing would happen here
    parsed_flowchart = parse_flowchart_to_nodes_and_edges(state['flowchartLogic'])
    
    # The 'parsedFlowchart' would then guide which node to go to next,
    # or what initial actions to take. For example, setting the 'current_node_id'.
    updated_scratchpad = "Agent initialized."
    if parsed_flowchart.get("entry_point"):
      updated_scratchpad += f" Flowchart parsed (conceptually). Entry point: {parsed_flowchart['entry_point']}. Ready to process."
    else:
      updated_scratchpad += " Flowchart parsing incomplete or entry point not found."

    # Example: If the agent is conversational and needs user input to start
    # if not state.get('userInput'):
    #     updated_scratchpad += "\\nWaiting for user input..."
    #     # Could set a flag in intermediateResults to signify waiting
    #     state['intermediateResults']['status'] = 'awaiting_input'

    return {
        "agentScratchpad": state.get("agentScratchpad","") + "\\n" + updated_scratchpad, 
        "parsedFlowchart": parsed_flowchart,
        "intermediateResults": state.get("intermediateResults", {}) # Ensure it exists
    }

# Example of a generic processing node. In reality, you'd have specific nodes
# for different actions in your flowchart (e.g., 'ask_clarifying_question_node', 'call_specific_tool_node', 'generate_response_node').
def process_input_and_determine_intent_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Process Input & Determine Intent (Conceptual) ---")
    userInput = state.get('userInput', '')
    useCase = state.get('useCaseDescription', '')
    scratchpad = state.get('agentScratchpad', '')
    intermediate_results = state.get('intermediateResults', {})

    print(f"Considering user input: '{userInput[:70]}...' based on use case: '{useCase[:70]}...'")

    # --- Placeholder Logic for setting intermediateResults for routing ---
    # This logic would be more sophisticated, likely involving an LLM call
    # or parsing the 'userInput' against patterns from the 'parsedFlowchart'.
    agent_response_text = "Processing step..."
    if "product" in userInput.lower() or "widget" in userInput.lower():
        intermediate_results['intent_type'] = 'product_inquiry'
        agent_response_text += " Detected product-related inquiry."
        # Example: if a tool was needed right away for product inquiry
        # if product_lookup_tool: # check if tool is defined
        #     try:
        #         tool_output = product_lookup_tool.invoke({"product_name": userInput}) # Simplistic, real extraction needed
        #         intermediate_results['product_lookup_result'] = tool_output
        #         agent_response_text += f" Tool call (product_lookup_tool) result: {tool_output}"
        #     except Exception as e:
        #         agent_response_text += f" Error calling product_lookup_tool: {e}"
        #         intermediate_results['product_lookup_error'] = str(e)
    elif "support" in userInput.lower() or "help" in userInput.lower():
        intermediate_results['intent_type'] = 'support_request'
        agent_response_text += " Detected support request."
    else:
        intermediate_results['intent_type'] = 'general_query'
        agent_response_text += " Detected general query."
    
    updated_scratchpad = scratchpad + f"\\nIntent determination: {intermediate_results.get('intent_type', 'unknown')}. Response hint: {agent_response_text}"
    
    return {
        "agentScratchpad": updated_scratchpad, 
        "intermediateResults": intermediate_results,
        "finalResponse": agent_response_text # This might be an intermediate response
    }

def handle_product_inquiry_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Handle Product Inquiry ---")
    # This node would be specifically for product inquiries.
    # It might use results from 'product_lookup_tool' if called previously,
    # or make a call to an LLM to formulate a response based on product data.
    product_info = state['intermediateResults'].get('product_lookup_result', 'No specific product information found yet.')
    final_response = f"Regarding your product inquiry: {product_info} How else can I help?"
    print(f"Formulating response for product inquiry: {final_response}")
    return {"finalResponse": final_response, "agentScratchpad": state.get("agentScratchpad","") + "\\nHandled product inquiry."}

def handle_general_query_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Handle General Query ---")
    userInput = state.get('userInput', 'your query')
    # This node might call an LLM to answer a general question.
    # llm = ChatOpenAI(model="gpt-3.5-turbo")
    # response = llm.invoke(f"Answer the following user query: {userInput}")
    # final_response = response.content
    final_response = f"For your general query about '{userInput}', here is some information... (LLM call placeholder)"
    print(f"Formulating response for general query: {final_response}")
    return {"finalResponse": final_response, "agentScratchpad": state.get("agentScratchpad","") + "\\nHandled general query."}


def final_output_node(state: AgentState) -> Dict[str, Any]:
    print("--- Node: Final Output ---")
    response = state.get('finalResponse', "No specific response was generated by the agent.")
    print(f"Agent's Final Response: {response}")
    # This node could also perform final cleanup or logging.
    return {"finalResponse": response} # Potentially could return END here if it's truly the last step.

# 5. Define Router/Conditional Logic
def route_based_on_intent(state: AgentState) -> Literal["product_inquiry_path", "general_query_path", "__end__"]:
    """
    Router function for conditional edges based on 'intent_type' in intermediateResults.
    """
    print("--- Router: route_based_on_intent ---")
    intent = state['intermediateResults'].get('intent_type')
    print(f"Routing based on intent: {intent}")

    if intent == 'product_inquiry':
        return "product_inquiry_path"
    elif intent == 'support_request': # Example: support might go to general or a dedicated path
        return "general_query_path" # Or "support_path" if defined
    elif intent == 'general_query':
        return "general_query_path"
    else:
        # If intent is unclear or processing should stop for other reasons
        print("Intent unclear or no specific path, routing to END.")
        return "__end__" 

# 6. Assemble the Graph
print("--- Assembling LangGraph ---")
# memory = SqliteSaver.from_conn_string(":memory:") # Example for checkpointing

builder = StateGraph(AgentState)
# builder = StateGraph(AgentState, checkpointer=memory) # With checkpointing

# Add nodes to the graph
builder.add_node("entry", entry_node)
builder.add_node("process_input", process_input_and_determine_intent_node) 
builder.add_node("handle_product_inquiry", handle_product_inquiry_node)
builder.add_node("handle_general_query", handle_general_query_node)
builder.add_node("final_output", final_output_node)


# Set the entry point for the graph
# This could also be dynamically set from 'parsedFlowchart.entry_point' if parsing is implemented
builder.set_entry_point("entry")

# Add edges to define the flow between nodes
builder.add_edge("entry", "process_input")

# Conditional Edges:
# After 'process_input', the 'route_based_on_intent' router decides the next step.
builder.add_conditional_edges(
    "process_input", # Source node
    route_based_on_intent, # Router function
    { # Mapping of router's return value to next node name
        "product_inquiry_path": "handle_product_inquiry",
        "general_query_path": "handle_general_query",
        # "support_path": "handle_support_node", # If a dedicated support node existed
        "__end__": "final_output" 
    }
)

# Edges from specific handlers to the final output or back to input processing for multi-turn
builder.add_edge("handle_product_inquiry", "final_output") # Or could loop back to 'process_input'
builder.add_edge("handle_general_query", "final_output")  # Or could loop back

# Define the end point of the graph (can also be a specific node that always leads to END)
# builder.add_edge("final_output", END) # If final_output isn't the absolute end.
# For this example, let's make final_output the last step before explicit END.
# If 'final_output_node' itself should signify the end, it can return END or be the target of an __end__ route.
# For clarity, adding an explicit edge to END from final_output.
builder.add_edge("final_output", END)


# 7. Compile the Graph
print("--- Compiling Graph ---")
try:
    # agent_executor = builder.compile()
    agent_executor = builder.compile(checkpointer=memory if 'memory' in locals() else None) # Compile with memory if defined
    print("Graph compiled successfully.")

    # 8. Invoke the Graph (Example)
    print("--- Example Invocation ---")
    initial_state_input = {
        "useCaseDescription": """${safeUseCaseDescription}""",
        "mcqAnswers": ${mcqAnswersPythonDict},
        "flowchartLogic": """${safeGeneratedFlowchartText}""",
        "userInput": "I need help with Widget Pro.", # Example user input for testing
        "agentScratchpad": "", 
        "intermediateResults": {}, 
        # "conversation_history": [], # Initialize if using conversational memory
        "finalResponse": None,
    }
    
    # config for streaming/invocation, e.g., for identifying a thread for persistence
    # invocation_config = {"configurable": {"thread_id": "user-123"}}

    print("\\nInvoking agent with initial state:", initial_state_input)
    # final_state_output = agent_executor.invoke(initial_state_input, config=invocation_config)
    final_state_output = agent_executor.invoke(initial_state_input) # Simpler invocation

    print("\\nFinal Agent State after invocation:", final_state_output)
    print("Final Response:", final_state_output.get('finalResponse'))

    # Example of streaming if you want to see each step:
    # print("\\nStreaming agent execution (conceptual)...")
    # for event_step in agent_executor.stream(initial_state_input, config=invocation_config):
    #     node_name = list(event_step.keys())[0]
    #     current_state_at_node = event_step[node_name]
    #     print(f"\\nOutput from node '{node_name}':")
    #     # print("Current State:", current_state_at_node) # Can be very verbose
    #     print(f"  Scratchpad: {current_state_at_node.get('agentScratchpad', '').splitlines()[-1]}") # last line of scratchpad
    #     print(f"  Intermediate Results: {current_state_at_node.get('intermediateResults')}")
    #     print(f"  Current Final Response: {current_state_at_node.get('finalResponse')}")
    #     print("--------------------------------------")
    # final_state_output_streamed = agent_executor.invoke(initial_state_input, config=invocation_config) # Get the final state after stream
    # print("\\nFinal Agent State after streamed invocation:", final_state_output_streamed)
    # print("Final Response from stream:", final_state_output_streamed.get('finalResponse'))


except Exception as e:
    print(f"Error during graph compilation or example invocation: {e}")
    import traceback
    traceback.print_exc()


print("--- End of Conceptual LangGraph Agent Definition ---")

# For more details on building with LangGraph, refer to the official LangGraph documentation.
# https://python.langchain.com/docs/langgraph
# LangChain Expression Language (LCEL): https://python.langchain.com/docs/expression_language/
# LangGraph Tools: https://python.langchain.com/docs/langgraph/how-tos/tools/
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
                <CardTitle className="font-headline text-2xl">Define Your AI Agent & Generate Flowchart</CardTitle>
              </div>
              <CardDescription>
                Describe your agent, answer clarifying questions, optionally provide a hand-drawn flowchart, and generate the textual flowchart.
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

              {generatedFlowchartText && !isLoadingFlowchart && (
                <div className="mt-6 space-y-3 border-t pt-6">
                  <Label htmlFor="generatedFlowchartStep1" className="text-base font-medium">Generated Flowchart (Editable)</Label>
                  <Textarea
                    id="generatedFlowchartStep1"
                    value={generatedFlowchartText}
                    onChange={(e) => setGeneratedFlowchartText(e.target.value)}
                    rows={10}
                    className="mt-1 font-code text-sm bg-input/30"
                    placeholder="Flowchart will appear here in a textual format..."
                  />
                  <Alert className="mt-2">
                    <Check className="h-4 w-4"/>
                    <AlertTitle>Review and Edit</AlertTitle>
                    <AlertDescription>
                      You can edit the flowchart here. When ready, proceed to the next step for final review and export.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
            <CardFooter>
              {generatedFlowchartText && !isLoadingFlowchart ? (
                <Button onClick={() => navigateToStep(2)} className="ml-auto text-base py-3 px-6">
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Next: Review & Export
                </Button>
              ) : (
                <Button 
                  onClick={handleGenerateFlowchart} 
                  disabled={isLoadingFlowchart || !useCaseDescription.trim()} 
                  className="ml-auto text-base py-3 px-6"
                >
                  {isLoadingFlowchart ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ScanText className="mr-2 h-5 w-5" />}
                  Generate Flowchart
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {currentStep === 2 && (
          <Card className="w-full max-w-3xl mx-auto shadow-lg">
            <CardHeader>
              <div className="flex items-center mb-2">
                 <DownloadCloud className="h-7 w-7 mr-3 text-primary" />
                <CardTitle className="font-headline text-2xl">Review & Export Agent</CardTitle>
              </div>
              <CardDescription>
                Review all inputs and the generated flowchart text. Then, download your AI agent's definition.
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
                    You can make final edits to the textual representation of the flowchart above. 
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

