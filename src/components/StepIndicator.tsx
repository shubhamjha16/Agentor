import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export function StepIndicator({ currentStep, totalSteps, stepTitles }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-center space-x-2 sm:space-x-4 md:space-x-8 mb-10 md:mb-12">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        return (
          <div key={stepNumber} className="flex flex-col items-center text-center w-1/3 max-w-[120px] sm:max-w-[150px]">
            <div
              className={cn(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 text-lg sm:text-xl font-semibold transition-all duration-300 ease-in-out",
                isActive ? "border-primary bg-primary text-primary-foreground scale-110" 
                         : isCompleted ? "border-primary bg-primary text-primary-foreground" 
                                       : "border-muted-foreground bg-card text-muted-foreground",
              )}
            >
              {isCompleted ? <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7" /> : <span>{stepNumber}</span>}
            </div>
            <p className={cn(
              "mt-2 text-xs sm:text-sm font-medium transition-colors duration-300 ease-in-out", 
              isActive ? "text-primary" : isCompleted ? "text-primary" : "text-muted-foreground"
            )}>
              {stepTitles[index]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
