import { ReactNode } from "react";

interface FormContainerProps {
  children: ReactNode;
}

const FormContainer = ({ children }: FormContainerProps) => {
  return (
    <div 
      className="w-full max-w-[90%] sm:max-w-md mx-auto rounded-2xl p-5 shadow-lg border border-border/50"
      style={{ backgroundColor: '#ffffff' }}
    >
      {children}
    </div>
  );
};

export default FormContainer;
