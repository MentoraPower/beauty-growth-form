import { ReactNode } from "react";

interface FormContainerProps {
  children: ReactNode;
}

const FormContainer = ({ children }: FormContainerProps) => {
  return (
    <div className="form-container">
      <div className="form-container-glow" />
      <div className="form-container-inner">
        {children}
      </div>
    </div>
  );
};

export default FormContainer;
