interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressBar = ({ currentStep, totalSteps }: ProgressBarProps) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-border">
        <div
          className="h-full gradient-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
