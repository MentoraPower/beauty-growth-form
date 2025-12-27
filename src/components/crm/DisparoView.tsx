import { useState } from "react";
import { cn } from "@/lib/utils";
import { AIChatInput } from "./AIChatInput";

interface DisparoViewProps {
  subOriginId: string | null;
}

export function DisparoView({ subOriginId }: DisparoViewProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = (message: string) => {
    console.log("Message sent:", message);
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat messages area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Messages will go here */}
      </div>

      {/* AI Chat Input - fixed at bottom */}
      <div className="p-6 pt-0">
        <div className="max-w-3xl mx-auto">
          <AIChatInput
            onSend={handleSend}
            isLoading={isLoading}
            placeholder="Digite sua mensagem aqui..."
          />
        </div>
      </div>
    </div>
  );
}
