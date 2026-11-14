"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommercialWizardStepperProps {
  steps: readonly string[];
  currentStep: number;
  furthestStep: number;
  onStepChange: (step: number) => void;
  disabled?: boolean;
  label: string;
}

export function CommercialWizardStepper({ steps, currentStep, furthestStep, onStepChange, disabled, label }: CommercialWizardStepperProps) {
  return <nav aria-label={label} className="shrink-0 border-b bg-card px-3 py-3 sm:px-5 sm:py-4">
    <ol className="grid grid-cols-5">
      {steps.map((title, index) => <li key={title} className="relative min-w-0">
        {index < steps.length - 1 ? <div aria-hidden="true" className="pointer-events-none absolute top-6 left-1/2 h-0.5 w-full bg-border"><span className={cn("block h-full origin-left bg-primary-text transition-transform motion-reduce:transition-none", index < currentStep ? "scale-x-100" : "scale-x-0")} /></div> : null}
        <Button type="button" variant="ghost" aria-label={`${index + 1}. ${title}`} aria-current={index === currentStep ? "step" : undefined} disabled={disabled || index > furthestStep} onClick={() => onStepChange(index)} className="relative h-auto w-full min-w-0 flex-col gap-2 rounded-lg p-0 text-center whitespace-normal hover:bg-transparent disabled:opacity-100">
          <span className="grid h-12 w-full place-items-center"><span aria-hidden="true" className={cn("relative z-10 grid size-11 place-items-center rounded-full border-2 bg-card text-lg font-semibold transition-[border-color,box-shadow,color] motion-reduce:transition-none sm:size-12", index <= currentStep ? "border-primary-text text-primary-text" : "border-border text-muted-foreground", index === currentStep && "ring-4 ring-primary-text/15")}>{index + 1}</span></span>
          <span className={cn("hidden min-w-0 max-w-full px-1 text-xs leading-snug font-medium break-words sm:block lg:text-sm", index <= currentStep ? "text-primary-text" : "text-muted-foreground")}>{title}</span>
        </Button>
      </li>)}
    </ol>
    <p aria-hidden="true" className="mt-2 text-center text-xs font-semibold text-primary-text sm:hidden">{steps[currentStep]}</p>
  </nav>;
}
