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
import { Play, Clock, CheckCircle2, Trash2, Copy, ArrowLeft, Plus, Mail } from "lucide-react";
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


interface EmailFlowStep {
  id: string;
  type: "start" | "wait" | "email" | "end";
  position?: { x: number; y: number };
  data: {
    label: string;
    waitTime?: number;
    waitUnit?: "minutes" | "hours" | "days" | "months";
    subject?: string;
    bodyHtml?: string;
  };
}

// Start Node Component - Pill shape, black/white
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
const WaitNode = ({ data, id }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localWaitTime, setLocalWaitTime] = useState((data.waitTime as number) || 1);
  const [localWaitUnit, setLocalWaitUnit] = useState((data.waitUnit as string) || "hours");
  
  const waitTime = (data.waitTime as number) || 1;
  const waitUnit = (data.waitUnit as string) || "hours";
  
  const unitLabels: Record<string, string> = {
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

  return (
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

      {/* Editor Dropdown */}
      {isEditing && (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-background border border-border rounded-lg shadow-xl z-50 nodrag">
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
  );
};

// Email Node Component - Large preview with dropdown editor
const EmailNode = ({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
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

  return (
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

      {/* Editor Dropdown */}
      {isEditing && (
        <div className="absolute top-full left-0 mt-2 w-[500px] bg-background border border-border rounded-lg shadow-xl z-50 nodrag">
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
  );
};

// End Node Component - Pill shape, black/white
const EndNode = ({ data }: NodeProps) => {
  return (
    <div className="px-5 py-2.5 rounded-full border border-border bg-background shadow-sm transition-all flex items-center gap-2">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
      <CheckCircle2 className="w-4 h-4 text-foreground" />
      <span className="text-sm font-medium text-foreground">{data.label as string}</span>
    </div>
  );
};

const nodeTypes = {
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
  triggerPipelineName: string;
}

export function EmailFlowBuilder({
  initialSteps,
  onSave,
  onCancel,
  automationName,
  triggerPipelineName,
}: EmailFlowBuilderProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Initialize nodes and edges (use saved positions if available)
  const initialNodes: Node[] = initialSteps?.length
    ? initialSteps.map((step, index) => ({
        id: step.id,
        type: step.type,
        position: step.position || { x: 150 + index * 220, y: 200 },
        data: step.data,
      }))
    : [
        {
          id: "start-1",
          type: "start",
          position: { x: 100, y: 200 },
          data: { label: "Início" },
        },
      ];

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

  const deleteSelectedNode = () => {
    if (!selectedNode || selectedNode.type === "start") return;

    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    setSelectedNode(null);
  };

  const duplicateSelectedNode = () => {
    if (!selectedNode || selectedNode.type === "start" || selectedNode.type === "end") return;

    const newId = `${selectedNode.type}-${Date.now()}`;
    const newNode: Node = {
      ...selectedNode,
      id: newId,
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 80,
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };


  const handleSave = () => {
    const steps: EmailFlowStep[] = nodes.map((node) => ({
      id: node.id,
      type: node.type as EmailFlowStep["type"],
      position: { x: node.position.x, y: node.position.y },
      data: node.data as EmailFlowStep["data"],
    }));
    onSave(steps);
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
              Gatilho: <span className="font-medium">{triggerPipelineName}</span>
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
        <div className="w-56 border-r border-border bg-background p-4 flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Arraste para adicionar
            </h3>
            <div className="space-y-2">
              {/* Wait Node */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow", "wait");
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-grab active:cursor-grabbing"
              >
                <Clock className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Tempo de Espera</span>
              </div>

              {/* Email Node */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow", "email");
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-grab active:cursor-grabbing"
              >
                <Mail className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Enviar E-mail</span>
              </div>

              {/* End Node */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow", "end");
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-grab active:cursor-grabbing"
              >
                <CheckCircle2 className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Finalizar</span>
              </div>
            </div>
          </div>

          {selectedNode && selectedNode.type !== "start" && (
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Ações
              </h3>
              <div className="space-y-2">
                {selectedNode.type !== "end" && (
                  <button
                    onClick={duplicateSelectedNode}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Duplicar</span>
                  </button>
                )}
                <button
                  onClick={deleteSelectedNode}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Excluir</span>
                </button>
              </div>
            </div>
          )}
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
