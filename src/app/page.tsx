
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
      console.error("Error generating flowchart:", e); // For developer debugging
      const specificErrorMessage = e instanceof Error ? e.message : "An unknown error occurred while generating the flowchart.";
      setError(specificErrorMessage); // Update Alert component with specific error
      toast({ 
        variant: "destructive", 
        title: "Flowchart Generation Failed", 
        description: specificErrorMessage // Show specific error in toast
      });
    } finally {
      setIsLoadingFlowchart(false);
    }
  };
  
  const handleExportAgent = () => {
    if (!generatedFlowchartText) return;
    const agentCode = `// Agentor AI Agent Code
// Generated on: ${new Date().toISOString()}
// Use Case: ${useCaseDescription}
// MCQ Answers: ${JSON.stringify(mcqAnswers, null, 2)}

// Flowchart Definition:
/*
${generatedFlowchartText}
*/

// --- Start of generated agent logic (Placeholder) ---

function main() {
  console.log("AI Agent Initialized");
  // Your agent's logic based on the flowchart would go here.
  // For example, if your flowchart has a 'Start' node:
  // executeNode('Start'); 
}

function executeNode(nodeName) {
  console.log("Executing node:", nodeName);
  // Add logic for each node type from your flowchart
}

main();

// --- End of generated agent logic ---
`;
    const blob = new Blob([agentCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agentor_ai_agent.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Agent Code Downloaded!", description: "Your AI agent code has been successfully downloaded." });
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
                Your AI agent is ready! Download the generated code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-1">Confirmed Flowchart:</h4>
                <pre className="p-4 border rounded-md bg-secondary/30 max-h-80 overflow-auto text-sm font-code">{generatedFlowchartText || "No flowchart confirmed."}</pre>
              </div>
              <Button onClick={handleExportAgent} disabled={!generatedFlowchartText.trim()} className="w-full sm:w-auto text-base py-3 px-6">
                <DownloadCloud className="mr-2 h-5 w-5" />
                Download Agent Code
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

