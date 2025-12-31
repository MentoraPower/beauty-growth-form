import React, { useState, useEffect } from 'react';
import { EmailEditorWithTabs } from './EmailEditorWithTabs';
import { extractSubjectAndHtml } from '@/lib/disparo/parsing';

interface CopyToHtmlGeneratorProps {
  copyText: string;
  companyName: string;
  productService: string;
  onGenerated: (html: string) => void;
}

const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;

export function CopyToHtmlGenerator({ 
  copyText,
  companyName,
  productService,
  onGenerated 
}: CopyToHtmlGeneratorProps) {
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    const generateHtml = async () => {
      try {
        const response = await fetch(GENERATE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hasCopy: true,
            copyText,
            companyName,
            productService
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao gerar HTML");
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullContent += content;
                // Extract and update HTML in real-time
                const { html } = extractSubjectAndHtml(fullContent);
                setGeneratedHtml(html);
              }
            } catch {
              // Incomplete JSON, continue
            }
          }
        }

        // Final extraction
        const { html: finalHtml } = extractSubjectAndHtml(fullContent);
        setGeneratedHtml(finalHtml);
        setIsGenerating(false);

      } catch (error) {
        console.error("Error generating HTML:", error);
        setIsGenerating(false);
      }
    };

    generateHtml();
  }, [copyText, companyName, productService]);

  return (
    <EmailEditorWithTabs
      html={generatedHtml}
      isGenerating={isGenerating}
      onHtmlChange={setGeneratedHtml}
      onUse={() => onGenerated(generatedHtml)}
    />
  );
}
