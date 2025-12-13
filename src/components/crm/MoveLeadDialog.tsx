import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  nome: string;
  origin_id: string;
}

interface Pipeline {
  id: string;
  nome: string;
  sub_origin_id: string | null;
}

interface MoveLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  currentSubOriginId: string | null;
  onMoved?: () => void;
}

export function MoveLeadDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  currentSubOriginId,
  onMoved,
}: MoveLeadDialogProps) {
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedOriginId, setSelectedOriginId] = useState<string>("");
  const [selectedSubOriginId, setSelectedSubOriginId] = useState<string>("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch origins
  useEffect(() => {
    const fetchOrigins = async () => {
      const { data } = await supabase
        .from("crm_origins")
        .select("*")
        .order("ordem");
      if (data) setOrigins(data);
    };
    if (open) fetchOrigins();
  }, [open]);

  // Fetch sub-origins when origin changes
  useEffect(() => {
    const fetchSubOrigins = async () => {
      if (!selectedOriginId) {
        setSubOrigins([]);
        return;
      }
      const { data } = await supabase
        .from("crm_sub_origins")
        .select("*")
        .eq("origin_id", selectedOriginId)
        .order("ordem");
      if (data) setSubOrigins(data);
    };
    fetchSubOrigins();
    setSelectedSubOriginId("");
    setSelectedPipelineId("");
  }, [selectedOriginId]);

  // Fetch pipelines when sub-origin changes
  useEffect(() => {
    const fetchPipelines = async () => {
      if (!selectedSubOriginId) {
        setPipelines([]);
        return;
      }
      const { data } = await supabase
        .from("pipelines")
        .select("*")
        .eq("sub_origin_id", selectedSubOriginId)
        .order("ordem");
      if (data) setPipelines(data);
    };
    fetchPipelines();
    setSelectedPipelineId("");
  }, [selectedSubOriginId]);

  const handleMove = async () => {
    if (!selectedSubOriginId || !selectedPipelineId) {
      toast.error("Selecione a sub-origem e pipeline de destino");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          sub_origin_id: selectedSubOriginId,
          pipeline_id: selectedPipelineId,
        })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Lead movido com sucesso!");
      onOpenChange(false);
      onMoved?.();
    } catch (error: any) {
      console.error("Error moving lead:", error);
      toast.error(`Erro ao mover lead: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSubOrigins = subOrigins.filter(
    (so) => so.id !== currentSubOriginId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Mover <span className="font-medium text-foreground">{leadName}</span> para outra sub-origem
          </p>

          {/* Origin Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Origem</label>
            <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {origins.map((origin) => (
                  <SelectItem key={origin.id} value={origin.id}>
                    {origin.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Origin Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sub-origem</label>
            <Select 
              value={selectedSubOriginId} 
              onValueChange={setSelectedSubOriginId}
              disabled={!selectedOriginId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sub-origem" />
              </SelectTrigger>
              <SelectContent>
                {filteredSubOrigins.map((subOrigin) => (
                  <SelectItem key={subOrigin.id} value={subOrigin.id}>
                    {subOrigin.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pipeline de destino</label>
            <Select 
              value={selectedPipelineId} 
              onValueChange={setSelectedPipelineId}
              disabled={!selectedSubOriginId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={!selectedPipelineId || isLoading}
            className="bg-gradient-to-r from-[#F40000] to-[#A10000] hover:opacity-90"
          >
            {isLoading ? "Movendo..." : "Mover Lead"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}