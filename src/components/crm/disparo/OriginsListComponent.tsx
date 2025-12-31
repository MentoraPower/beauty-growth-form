import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Origin {
  id: string;
  nome: string;
  crm_sub_origins: { id: string; nome: string }[];
}

interface OriginsListComponentProps {
  origins: Origin[];
  onSelect?: (subOriginId: string, subOriginName: string, originName: string) => void;
}

export function OriginsListComponent({ origins, onSelect }: OriginsListComponentProps) {
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedSubOriginId, setSelectedSubOriginId] = useState<string | null>(null);

  const selectedOrigin = origins.find(o => o.id === selectedOriginId);

  const handleOriginSelect = (originId: string) => {
    setSelectedOriginId(originId);
    setSelectedSubOriginId(null);
  };

  const handleSubOriginSelect = (subOrigin: { id: string; nome: string }, originName: string) => {
    setSelectedSubOriginId(subOrigin.id);
    onSelect?.(subOrigin.id, subOrigin.nome, originName);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 space-y-3"
    >
      {/* Step 1: Select Origin */}
      <div className="text-sm text-muted-foreground mb-2">Selecione a origem:</div>
      <div className="flex flex-wrap gap-2">
        {origins.map(origin => (
          <button
            key={origin.id}
            onClick={() => handleOriginSelect(origin.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm transition-colors",
              selectedOriginId === origin.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            {origin.nome}
          </button>
        ))}
      </div>

      {/* Step 2: Select Sub-Origin */}
      {selectedOrigin && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3"
        >
          <div className="text-sm text-muted-foreground mb-2">Selecione a lista:</div>
          <div className="flex flex-wrap gap-2">
            {selectedOrigin.crm_sub_origins.map(sub => (
              <button
                key={sub.id}
                onClick={() => handleSubOriginSelect(sub, selectedOrigin.nome)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  selectedSubOriginId === sub.id
                    ? "bg-green-500 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                )}
              >
                {sub.nome}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
