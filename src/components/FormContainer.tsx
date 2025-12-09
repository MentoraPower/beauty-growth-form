import { ReactNode } from "react";

interface FormContainerProps {
  children: ReactNode;
}

const FormContainer = ({ children }: FormContainerProps) => {
  return (
    <div className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-border/50">
      {children}
    </div>
  );
};

export default FormContainer;
