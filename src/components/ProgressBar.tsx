interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressBar = ({ currentStep, totalSteps }: ProgressBarProps) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full gradient-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right mt-2">
        {currentStep} de {totalSteps}
      </p>
    </div>
  );
};

export default ProgressBar;
