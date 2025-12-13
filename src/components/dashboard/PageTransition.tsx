import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  // Simple wrapper - let individual pages handle their own loading states
  return <>{children}</>;
}
