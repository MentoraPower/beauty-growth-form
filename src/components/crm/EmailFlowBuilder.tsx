import { useState, useCallback, useMemo, useRef } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Clock, CheckCircle2, Trash2, Copy, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


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

// Wait Node Component - Square shape
const WaitNode = ({ data, id }: NodeProps) => {
  const waitTime = (data.waitTime as number) || 1;
  const waitUnit = (data.waitUnit as string) || "hours";
  const unitLabels: Record<string, string> = {
    minutes: "min",
    hours: "h",
    days: "d",
    months: "m",
  };

  return (
    <div className="w-44 border border-border bg-background shadow-sm transition-all rounded-lg overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Clock className="w-4 h-4 text-foreground" />
        <span className="text-xs font-semibold text-foreground uppercase">Espera</span>
      </div>
      <div className="px-4 py-3">
        <span className="text-lg font-semibold text-foreground">
          {waitTime} {unitLabels[waitUnit]}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
    </div>
  );
};

// Mail Icon - Simple black/white
const MailIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

// Email Node Component - Square shape with inline editor
const EmailNode = ({ data }: NodeProps) => {
  const subject = (data.subject as string) || "";
  const bodyHtml = (data.bodyHtml as string) || "";

  return (
    <div className="w-[520px] border border-border bg-background shadow-sm transition-all rounded-lg overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <MailIcon className="w-4 h-4 text-foreground" />
        <span className="text-xs font-semibold text-foreground uppercase">E-mail</span>
      </div>
      <div className="flex">
        {/* Editor side */}
        <div className="flex-1 p-3 border-r border-border">
          <div className="mb-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Assunto</label>
            <div className="text-sm text-foreground mt-0.5 truncate">
              {subject || <span className="text-muted-foreground italic">Clique para editar</span>}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">HTML</label>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono line-clamp-3 whitespace-pre-wrap">
              {bodyHtml || <span className="italic">Sem conteúdo</span>}
            </div>
          </div>
        </div>
        {/* Preview side */}
        <div className="w-[200px] p-3 bg-muted/20">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Preview</label>
          <div 
            className="text-xs bg-background rounded border border-border p-2 min-h-[60px] max-h-[80px] overflow-hidden"
            dangerouslySetInnerHTML={{ __html: bodyHtml || '<span style="color:#999">Prévia do e-mail</span>' }}
          />
        </div>
      </div>
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
                <MailIcon className="w-4 h-4 mr-2" />
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    waitTime?: number;
    waitUnit?: string;
    subject?: string;
    bodyHtml?: string;
  }>({});

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
    if (node.type === "wait" || node.type === "email") {
      setEditData({
        waitTime: node.data.waitTime as number,
        waitUnit: node.data.waitUnit as string,
        subject: node.data.subject as string,
        bodyHtml: node.data.bodyHtml as string,
      });
      setEditDialogOpen(true);
    }
  }, []);

  const addNode = (type: "wait" | "email" | "end") => {
    const lastNode = nodes[nodes.length - 1];
    const newId = `${type}-${Date.now()}`;
    const newX = lastNode ? lastNode.position.x + 220 : 100;

    const defaultData: Record<string, any> = {
      wait: { label: "Espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "E-mail", subject: "", bodyHtml: "" },
      end: { label: "Fim" },
    };

    const newNode: Node = {
      id: newId,
      type,
      position: { x: newX, y: 200 },
      data: defaultData[type],
    };

    setNodes((nds) => [...nds, newNode]);

    // Auto-connect to last node
    if (lastNode) {
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
  };

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

  const saveEditData = () => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                ...editData,
              },
            }
          : n
      )
    );
    setEditDialogOpen(false);
    setSelectedNode(null);
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
              Adicionar Nó
            </h3>
            <div className="space-y-2">
              {/* Wait Node */}
              <button
                onClick={() => addNode("wait")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
              >
                <Clock className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Tempo de Espera</span>
              </button>

              {/* Email Node */}
              <button
                onClick={() => addNode("email")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
              >
                <MailIcon className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Enviar E-mail</span>
              </button>

              {/* End Node */}
              <button
                onClick={() => addNode("end")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
              >
                <CheckCircle2 className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">Finalizar</span>
              </button>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedNode?.type === "wait" ? "Configurar tempo de espera" : "Configurar e-mail"}
            </DialogTitle>
          </DialogHeader>

          {selectedNode?.type === "wait" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tempo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editData.waitTime || 1}
                    onChange={(e) =>
                      setEditData({ ...editData, waitTime: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select
                    value={editData.waitUnit || "hours"}
                    onValueChange={(v) => setEditData({ ...editData, waitUnit: v })}
                  >
                    <SelectTrigger>
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
            </div>
          )}

          {selectedNode?.type === "email" && (
            <div className="space-y-5">
              {/* Gmail-style Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <MailIcon className="w-6 h-6 text-foreground" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Configurar E-mail</h4>
                  <p className="text-xs text-muted-foreground">Edite o assunto e conteúdo do e-mail</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assunto</Label>
                <Input
                  placeholder="Ex: {{nome}}, seu e-book está pronto!"
                  value={editData.subject || ""}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  className="mt-1.5 h-11 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{"{{nome}}"}</span>
                  <span>insere o nome do lead</span>
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Corpo do E-mail (HTML)</Label>
                <Textarea
                  placeholder="<h1>Olá {{nome}}!</h1>&#10;<p>Seu conteúdo aqui...</p>"
                  value={editData.bodyHtml || ""}
                  onChange={(e) => setEditData({ ...editData, bodyHtml: e.target.value })}
                  className="mt-1.5 min-h-[220px] font-mono text-sm leading-relaxed resize-none"
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium">HTML</span>
                  <span className="text-xs text-muted-foreground">Suporta formatação HTML completa</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEditData} className="bg-foreground text-background hover:bg-foreground/90">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
