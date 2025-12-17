import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Clock, CheckCircle2, Trash2, Copy, ArrowLeft, Plus, Mail, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import gmailLogo from "@/assets/gmail-logo.png";

interface Pipeline {
  id: string;
  nome: string;
  sub_origin_id?: string | null;
}

interface EmailFlowStep {
  id: string;
  type: "trigger" | "start" | "wait" | "email" | "end";
  position?: { x: number; y: number };
  data: {
    label: string;
    waitTime?: number;
    waitUnit?: "minutes" | "hours" | "days" | "months";
    subject?: string;
    bodyHtml?: string;
    triggerType?: string;
    triggerPipelineId?: string;
  };
}

// Trigger Node Component - Main entry point with trigger selection
const TriggerNode = ({ data, id, selected }: NodeProps & { data: { 
  label: string; 
  triggerType?: string; 
  triggerPipelineId?: string;
  pipelines?: Pipeline[];
  onTriggerChange?: (triggerType: string, pipelineId?: string) => void;
}}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTriggerType, setLocalTriggerType] = useState(data.triggerType || "");
  const [localPipelineId, setLocalPipelineId] = useState(data.triggerPipelineId || "");

  const triggerOptions = [
    { id: "lead_created", label: "Lead criado" },
    { id: "lead_updated", label: "Lead atualizado" },
    { id: "lead_entered_pipeline", label: "Lead entrou em pipeline" },
  ];

  const getTriggerLabel = () => {
    if (!localTriggerType) return "Adicionar gatilho";
    const option = triggerOptions.find(o => o.id === localTriggerType);
    if (localTriggerType === "lead_entered_pipeline" && localPipelineId) {
      const pipeline = data.pipelines?.find(p => p.id === localPipelineId);
      return `${option?.label}: ${pipeline?.nome || ""}`;
    }
    return option?.label || "Adicionar gatilho";
  };

  const handleSaveTrigger = () => {
    if (data.onTriggerChange) {
      data.onTriggerChange(localTriggerType, localPipelineId);
    }
    setIsEditing(false);
  };

  return (
    <div className="relative">
      <div 
        className="min-w-[200px] border border-border bg-foreground shadow-sm transition-all rounded-xl overflow-hidden cursor-pointer"
        onClick={() => setIsEditing(!isEditing)}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F40000 0%, #A10000 100%)" }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <span className="text-xs text-muted-foreground block">Gatilho</span>
            <span className="text-sm font-medium text-background">{getTriggerLabel()}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-background/60" />
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-background !border-2 !border-foreground"
        />
      </div>

      {/* Dropdown editor */}
      {isEditing && (
        <div 
          className="absolute top-0 left-full ml-2 z-50 bg-background border border-border rounded-lg shadow-lg p-3 w-64 nodrag"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Tipo de gatilho
              </label>
              <Select value={localTriggerType} onValueChange={setLocalTriggerType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {localTriggerType === "lead_entered_pipeline" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Pipeline
                </label>
                <Select value={localPipelineId} onValueChange={setLocalPipelineId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione a pipeline..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data.pipelines?.map(pipeline => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              size="sm" 
              className="w-full"
              onClick={handleSaveTrigger}
              disabled={!localTriggerType || (localTriggerType === "lead_entered_pipeline" && !localPipelineId)}
            >
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Start Node Component - Pill shape, black/white (legacy support)
const StartNode = ({ data }: NodeProps) => {
  return (
    <div className="px-5 py-2.5 rounded-full border border-foreground bg-foreground shadow-sm transition-all flex items-center gap-2">
      <Play className="w-4 h-4 text-background fill-background" />
      <span className="text-sm font-medium text-background">{data.label as string}</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-background !border-2 !border-foreground"
      />
    </div>
  );
};

// Wait Node Component - Modern yellow design with dropdown
const WaitNode = ({ data, id, selected }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localWaitTime, setLocalWaitTime] = useState((data.waitTime as number) || 1);
  const [localWaitUnit, setLocalWaitUnit] = useState((data.waitUnit as string) || "hours");
  
  const waitTime = (data.waitTime as number) || 1;
  const waitUnit = (data.waitUnit as string) || "hours";
  
  const unitLabels: Record<string, string> = {
    seconds: "segundos",
    minutes: "minutos",
    hours: "horas",
    days: "dias",
    months: "meses",
  };

  // Auto-save on change while editing
  useEffect(() => {
    if (!isEditing) return;
    
    const timeout = setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, waitTime: localWaitTime, waitUnit: localWaitUnit } }
            : node
        )
      );
    }, 300);

    return () => clearTimeout(timeout);
  }, [localWaitTime, localWaitUnit, isEditing, id, setNodes]);

  const handleOpen = () => {
    setLocalWaitTime(waitTime);
    setLocalWaitUnit(waitUnit);
    setIsEditing(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => {
      const currentNode = nds.find((n) => n.id === id);
      if (!currentNode) return nds;
      return [
        ...nds,
        {
          ...currentNode,
          id: `wait-${Date.now()}`,
          position: { x: currentNode.position.x + 50, y: currentNode.position.y + 80 },
          selected: false,
        },
      ];
    });
  };

  return (
    <div className="relative">
      <div className="w-56 border border-border bg-background shadow-sm transition-all rounded-xl overflow-hidden">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
        />
        {/* Yellow header */}
        <div 
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)" }}
          onClick={handleOpen}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-semibold text-black uppercase tracking-wide">Espera</span>
          </div>
        </div>
        
        {/* Time display */}
        <div className="px-4 py-4 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {waitTime}
          </span>
          <span className="text-sm text-muted-foreground ml-2">
            {unitLabels[waitUnit]}
          </span>
        </div>

        {/* Editor Dropdown - Side */}
        {isEditing && (
          <div className="absolute top-0 left-full ml-2 w-[280px] bg-background border border-border rounded-lg shadow-xl z-50 nodrag">
            <div className="p-4 border-b border-border bg-muted/30">
              <h4 className="text-sm font-semibold text-foreground">Configurar tempo</h4>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Tempo</label>
                  <Input
                    type="number"
                    min={1}
                    value={localWaitTime}
                    onChange={(e) => setLocalWaitTime(parseInt(e.target.value) || 1)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Unidade</label>
                  <Select
                    value={localWaitUnit}
                    onValueChange={(v) => setLocalWaitUnit(v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Segundos</SelectItem>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setIsEditing(false)} className="bg-foreground text-background hover:bg-foreground/90">
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
        />
      </div>

      {/* Action buttons - slide down from top */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 8px)' }}
      >
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted/60 transition-colors text-xs font-medium text-foreground shadow-sm"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
};

// Email Node Component - Large preview with dropdown editor
const EmailNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localSubject, setLocalSubject] = useState((data.subject as string) || "");
  const [localBodyHtml, setLocalBodyHtml] = useState((data.bodyHtml as string) || "");
  
  const subject = (data.subject as string) || "";
  const bodyHtml = (data.bodyHtml as string) || "";

  // Auto-save on change while editing
  useEffect(() => {
    if (!isEditing) return;
    
    const timeout = setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, subject: localSubject, bodyHtml: localBodyHtml } }
            : node
        )
      );
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeout);
  }, [localSubject, localBodyHtml, isEditing, id, setNodes]);

  const handleOpen = () => {
    setLocalSubject(subject);
    setLocalBodyHtml(bodyHtml);
    setIsEditing(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => {
      const currentNode = nds.find((n) => n.id === id);
      if (!currentNode) return nds;
      return [
        ...nds,
        {
          ...currentNode,
          id: `email-${Date.now()}`,
          position: { x: currentNode.position.x + 50, y: currentNode.position.y + 80 },
          selected: false,
        },
      ];
    });
  };

  return (
    <div className="relative">
      <div className="w-[420px] border border-border bg-background shadow-sm transition-all rounded-lg overflow-hidden">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
        />
        {/* Red gradient header with Gmail logo */}
        <div 
          className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #F40000 0%, #A10000 100%)" }}
          onClick={handleOpen}
        >
          <div className="flex items-center gap-3">
            <img src={gmailLogo} alt="Gmail" className="w-7 h-7 rounded" />
            <div>
              <span className="text-xs font-semibold text-white uppercase tracking-wide block">E-mail</span>
              {subject && <span className="text-[11px] text-white/80 truncate block max-w-[280px]">{subject}</span>}
            </div>
          </div>
          <span className="text-white/70 text-xs">Clique para editar</span>
        </div>
        
        {/* Email Preview - Large */}
        <div className="p-4 bg-muted/10 min-h-[500px]">
          <div 
            className="bg-background rounded-lg border border-border p-4 min-h-[480px] text-sm overflow-y-auto nodrag nowheel"
            style={{ maxHeight: "520px" }}
            onWheelCapture={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ 
              __html: bodyHtml || '<div style="color:#999; text-align:center; padding-top:220px;">Clique no cabeçalho para editar o e-mail</div>' 
            }}
          />
        </div>

        {/* Editor Dropdown - Side */}
        {isEditing && (
          <div className="absolute top-0 left-full ml-2 w-[500px] bg-background border border-border rounded-lg shadow-xl z-50 nodrag">
            <div className="p-4 border-b border-border bg-muted/30">
              <h4 className="text-sm font-semibold text-foreground">Editar E-mail</h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Assunto</label>
                <Input
                  value={localSubject}
                  onChange={(e) => setLocalSubject(e.target.value)}
                  placeholder="Ex: {{nome}}, seu e-book está pronto!"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Código HTML</label>
                <Textarea
                  value={localBodyHtml}
                  onChange={(e) => setLocalBodyHtml(e.target.value)}
                  onWheelCapture={(e) => e.stopPropagation()}
                  placeholder="<h1>Olá {{nome}}!</h1>&#10;<p>Seu conteúdo aqui...</p>"
                  className="h-[200px] text-xs font-mono resize-none overflow-y-auto nowheel"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setIsEditing(false)} className="bg-foreground text-background hover:bg-foreground/90">
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
        />
      </div>

      {/* Action buttons - slide down from top */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 8px)' }}
      >
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted/60 transition-colors text-xs font-medium text-foreground shadow-sm"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
};

// End Node Component - Pill shape, black/white with delete
const EndNode = ({ data, id, selected }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div className="relative">
      <div className="px-5 py-2.5 rounded-full border border-border bg-background shadow-sm transition-all flex items-center gap-2">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
        />
        <CheckCircle2 className="w-4 h-4 text-foreground" />
        <span className="text-sm font-medium text-foreground">{data.label as string}</span>
      </div>

      {/* Action button - slide down from top */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 transition-all duration-200 nodrag ${
          selected ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ bottom: 'calc(100% + 8px)' }}
      >
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors text-xs font-medium text-destructive shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  start: StartNode,
  wait: WaitNode,
  email: EmailNode,
  end: EndNode,
};

// Custom Edge with + button
interface CustomEdgeProps extends EdgeProps {
  data?: {
    onAddNode?: (edgeId: string, type: "wait" | "email") => void;
    onDeleteEdge?: (edgeId: string) => void;
  };
}

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: CustomEdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="#EA4335"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        strokeLinecap="round"
        style={{
          animation: "flowDash 1s linear infinite",
        }}
      />
      <circle
        cx={targetX}
        cy={targetY}
        r={3}
        fill="#A10000"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted hover:scale-110 transition-all">
                <Plus className="w-3 h-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-40">
              <DropdownMenuItem onClick={() => data?.onAddNode?.(id, "wait")}>
                <Clock className="w-4 h-4 mr-2 text-amber-500" />
                Tempo de Espera
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data?.onAddNode?.(id, "email")}>
                <Mail className="w-4 h-4 mr-2" />
                Enviar E-mail
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => data?.onDeleteEdge?.(id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar conexão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

interface EmailFlowBuilderProps {
  initialSteps?: EmailFlowStep[];
  onSave: (steps: EmailFlowStep[]) => void;
  onCancel: () => void;
  automationName: string;
  triggerPipelineName?: string;
  pipelines?: Pipeline[];
  subOriginId?: string | null;
}

export function EmailFlowBuilder({
  initialSteps,
  onSave,
  onCancel,
  automationName,
  triggerPipelineName,
  pipelines = [],
  subOriginId,
}: EmailFlowBuilderProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [triggerType, setTriggerType] = useState<string>("");
  const [triggerPipelineId, setTriggerPipelineId] = useState<string>("");

  // Filter pipelines for current sub-origin
  const filteredPipelines = useMemo(() => {
    if (!subOriginId) return pipelines;
    return pipelines.filter(p => p.sub_origin_id === subOriginId);
  }, [pipelines, subOriginId]);

  // Handle trigger changes from the node
  const handleTriggerChange = useCallback((type: string, pipelineId?: string) => {
    setTriggerType(type);
    if (pipelineId) setTriggerPipelineId(pipelineId);
    
    // Update the trigger node data
    setNodes((nds) => nds.map((n) => {
      if (n.type === "trigger") {
        return {
          ...n,
          data: {
            ...n.data,
            triggerType: type,
            triggerPipelineId: pipelineId,
          },
        };
      }
      return n;
    }));
  }, []);

  // Initialize nodes and edges (use saved positions if available)
  const initialNodes: Node[] = useMemo(() => {
    if (initialSteps?.length) {
      return initialSteps.map((step, index) => {
        // Convert old 'start' nodes to 'trigger' nodes
        const nodeType = step.type === "start" ? "trigger" : step.type;
        return {
          id: step.id,
          type: nodeType,
          position: step.position || { x: 150 + index * 220, y: 200 },
          data: {
            ...step.data,
            pipelines: filteredPipelines,
            onTriggerChange: handleTriggerChange,
          },
        };
      });
    }
    return [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: { 
          label: "Gatilho",
          pipelines: filteredPipelines,
          onTriggerChange: handleTriggerChange,
        },
      },
    ];
  }, [initialSteps, filteredPipelines, handleTriggerChange]);

  const initialEdges: Edge[] = initialSteps?.length
    ? initialSteps.slice(0, -1).map((step, index) => ({
        id: `e-${step.id}-${initialSteps[index + 1].id}`,
        source: step.id,
        target: initialSteps[index + 1].id,
        type: "custom",
      }))
    : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "custom",
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = useCallback((type: "wait" | "email" | "end", position?: { x: number; y: number }) => {
    const lastNode = nodes[nodes.length - 1];
    const newId = `${type}-${Date.now()}`;
    const newX = position?.x ?? (lastNode ? lastNode.position.x + 220 : 100);
    const newY = position?.y ?? 200;

    const defaultData: Record<string, any> = {
      wait: { label: "Espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "E-mail", subject: "", bodyHtml: "" },
      end: { label: "Fim" },
    };

    const newNode: Node = {
      id: newId,
      type,
      position: { x: newX, y: newY },
      data: defaultData[type],
    };

    setNodes((nds) => [...nds, newNode]);

    // Auto-connect to last node only if no position was specified (non-drag)
    if (!position && lastNode) {
      setEdges((eds) => [
        ...eds,
        {
          id: `e-${lastNode.id}-${newId}`,
          source: lastNode.id,
          target: newId,
          type: "custom",
        },
      ]);
    }
  }, [nodes, setNodes, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as "wait" | "email" | "end";
      if (!type) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      addNode(type, position);
    },
    [addNode]
  );

  // Add node between two connected nodes
  const addNodeBetween = useCallback((edgeId: string, type: "wait" | "email") => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const newId = `${type}-${Date.now()}`;
    const defaultData: Record<string, any> = {
      wait: { label: "Espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "E-mail", subject: "", bodyHtml: "" },
    };

    // Position the new node between source and target
    const newNode: Node = {
      id: newId,
      type,
      position: {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      },
      data: defaultData[type],
    };

    // Remove the old edge and create two new edges
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds.filter((e) => e.id !== edgeId),
      {
        id: `e-${edge.source}-${newId}`,
        source: edge.source,
        target: newId,
        type: "custom",
      },
      {
        id: `e-${newId}-${edge.target}`,
        source: newId,
        target: edge.target,
        type: "custom",
      },
    ]);
  }, [edges, nodes, setNodes, setEdges]);

  // Delete edge
  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  // Use refs for stable callback references to avoid re-renders
  const addNodeBetweenRef = useRef(addNodeBetween);
  addNodeBetweenRef.current = addNodeBetween;

  const deleteEdgeRef = useRef(deleteEdge);
  deleteEdgeRef.current = deleteEdge;

  // Memoized edges with data callbacks - only recalculates when edges change
  const edgesWithData = useMemo(() => 
    edges.map((edge) => ({
      ...edge,
      data: {
        onAddNode: (edgeId: string, type: "wait" | "email") => 
          addNodeBetweenRef.current(edgeId, type),
        onDeleteEdge: (edgeId: string) => 
          deleteEdgeRef.current(edgeId),
      },
    })),
    [edges]
  );


  const handleSave = () => {
    // Get trigger data from the trigger node
    const triggerNode = nodes.find(n => n.type === "trigger");
    const currentTriggerType = triggerNode?.data?.triggerType as string || triggerType;
    const currentTriggerPipelineId = triggerNode?.data?.triggerPipelineId as string || triggerPipelineId;

    if (!currentTriggerType) {
      // Could show a toast here, but for now just warn
      console.warn("No trigger type selected");
    }

    const steps: EmailFlowStep[] = nodes.map((node) => ({
      id: node.id,
      type: node.type as EmailFlowStep["type"],
      position: { x: node.position.x, y: node.position.y },
      data: {
        ...node.data as EmailFlowStep["data"],
        // Clean up internal props before saving
        pipelines: undefined,
        onTriggerChange: undefined,
      },
    }));
    onSave(steps);
  };

  // Get current trigger label for header
  const getTriggerHeaderLabel = () => {
    const triggerNode = nodes.find(n => n.type === "trigger");
    const type = triggerNode?.data?.triggerType as string || triggerType;
    const pipelineId = triggerNode?.data?.triggerPipelineId as string || triggerPipelineId;
    
    if (!type) return "Nenhum gatilho definido";
    
    const triggerLabels: Record<string, string> = {
      lead_created: "Lead criado",
      lead_updated: "Lead atualizado", 
      lead_entered_pipeline: "Lead entrou em pipeline",
    };
    
    if (type === "lead_entered_pipeline" && pipelineId) {
      const pipeline = filteredPipelines.find(p => p.id === pipelineId);
      return `${triggerLabels[type]}: ${pipeline?.nome || ""}`;
    }
    
    return triggerLabels[type] || type;
  };

  return (
    <div className="flex flex-col h-full w-full bg-muted/30 rounded-2xl overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{automationName}</h2>
            <p className="text-xs text-muted-foreground">
              Gatilho: <span className="font-medium">{getTriggerHeaderLabel()}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-foreground text-background hover:bg-foreground/90">
            Salvar fluxo
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <div className="border-r border-border bg-background p-4 flex flex-col gap-4">
          <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-2" style={{ border: "1px solid #00000015" }}>
            {/* Wait Node - Yellow icon */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", "wait");
                e.dataTransfer.effectAllowed = "move";
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted/50 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
              style={{ border: "1px solid #00000015" }}
              title="Tempo de Espera"
            >
              <Clock className="w-5 h-5" style={{ color: "#FBBF24" }} />
            </div>

            {/* Email Node - White icon */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", "email");
                e.dataTransfer.effectAllowed = "move";
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted/50 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
              style={{ border: "1px solid #00000015" }}
              title="Enviar E-mail"
            >
              <Mail className="w-5 h-5 text-foreground" />
            </div>

            {/* End Node - Red icon */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", "end");
                e.dataTransfer.effectAllowed = "move";
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted/50 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
              style={{ border: "1px solid #00000015" }}
              title="Finalizar"
            >
              <CheckCircle2 className="w-5 h-5" style={{ color: "#F40000" }} />
            </div>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edgesWithData}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              type: "custom",
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls 
              className="!bg-background !border-border !shadow-sm !rounded-lg"
              showInteractive={false}
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d4d4d8" />
          </ReactFlow>
        </div>
      </div>

    </div>
  );
}
