import { useState } from "react";
import { cn } from "@/lib/utils";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { motion } from "framer-motion";

interface DisparoViewProps {
  subOriginId: string | null;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export function DisparoView({ subOriginId }: DisparoViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = (message: string, files?: File[]) => {
    console.log("Message sent:", message, files);
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: message,
      role: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: "Esta é uma resposta simulada da IA.",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 2000);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* When no messages, center the input */}
      {!hasMessages ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-foreground">
                Eai, oque vamos disparar hoje?
              </h2>
            </div>
            <PromptInputBox
              onSend={handleSend}
              isLoading={isLoading}
              placeholder="Digite sua mensagem aqui..."
            />
          </motion.div>
        </div>
      ) : (
        <>
          {/* Chat messages area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-2xl",
                    msg.role === "user"
                      ? "text-foreground ml-auto max-w-[80%]"
                      : "text-foreground mr-auto max-w-[80%]"
                  )}
                >
                  {msg.content}
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-foreground p-4 rounded-2xl mr-auto max-w-[80%]"
                >
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* AI Chat Input - fixed at bottom */}
          <div className="p-6 pt-0">
            <div className="max-w-3xl mx-auto">
              <PromptInputBox
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="Digite sua mensagem aqui..."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
