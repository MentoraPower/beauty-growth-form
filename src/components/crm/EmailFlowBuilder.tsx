import { useState, useCallback } from "react";
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
  MarkerType,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Clock, Mail, CheckCircle2, Trash2, Copy, X, ArrowLeft } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface EmailFlowStep {
  id: string;
  type: "start" | "wait" | "email" | "end";
  data: {
    label: string;
    waitTime?: number;
    waitUnit?: "minutes" | "hours" | "days" | "months";
    subject?: string;
    bodyHtml?: string;
  };
}

// Start Node Component
const StartNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={cn(
        "px-5 py-3 rounded-full border bg-background shadow-sm transition-all flex items-center gap-3",
        selected ? "border-foreground ring-2 ring-foreground/10" : "border-border"
      )}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
        <Play className="w-4 h-4 text-white fill-white" />
      </div>
      <span className="text-sm font-medium text-foreground pr-2">{data.label as string}</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
    </div>
  );
};

// Wait Node Component
const WaitNode = ({ data, selected }: NodeProps) => {
  const waitTime = (data.waitTime as number) || 1;
  const waitUnit = (data.waitUnit as string) || "hours";
  const unitLabels: Record<string, string> = {
    minutes: "min",
    hours: "h",
    days: "d",
    months: "m",
  };

  return (
    <div
      className={cn(
        "px-5 py-3 rounded-full border bg-background shadow-sm transition-all flex items-center gap-3",
        selected ? "border-foreground ring-2 ring-foreground/10" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
        <Clock className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm font-medium text-foreground pr-2">
        Esperar {waitTime}{unitLabels[waitUnit]}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
    </div>
  );
};

// Email Node Component
const EmailNode = ({ data, selected }: NodeProps) => {
  const subject = (data.subject as string) || "E-mail";

  return (
    <div
      className={cn(
        "px-5 py-3 rounded-full border bg-background shadow-sm transition-all flex items-center gap-3 max-w-[280px]",
        selected ? "border-foreground ring-2 ring-foreground/10" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
        <Mail className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm font-medium text-foreground truncate pr-2">{subject}</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
    </div>
  );
};

// End Node Component
const EndNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={cn(
        "px-5 py-3 rounded-full border bg-background shadow-sm transition-all flex items-center gap-3",
        selected ? "border-foreground ring-2 ring-foreground/10" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-foreground !border-2 !border-background"
      />
      <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
        <CheckCircle2 className="w-4 h-4 text-background" />
      </div>
      <span className="text-sm font-medium text-foreground pr-2">{data.label as string}</span>
    </div>
  );
};

const nodeTypes = {
  start: StartNode,
  wait: WaitNode,
  email: EmailNode,
  end: EndNode,
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

  // Initialize nodes and edges
  const initialNodes: Node[] = initialSteps?.length
    ? initialSteps.map((step, index) => ({
        id: step.id,
        type: step.type,
        position: { x: 150 + index * 220, y: 200 },
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
        markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
        style: { strokeWidth: 1.5, stroke: "#a1a1aa" },
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
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
            style: { strokeWidth: 1.5, stroke: "#a1a1aa" },
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
          markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
          style: { strokeWidth: 1.5, stroke: "#a1a1aa" },
        },
      ]);
    }
  };

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
      data: node.data as EmailFlowStep["data"],
    }));
    onSave(steps);
  };

  const nodeItems = [
    { type: "wait" as const, icon: Clock, label: "Tempo de Espera", color: "bg-amber-500" },
    { type: "email" as const, icon: Mail, label: "Enviar E-mail", color: "bg-blue-500" },
    { type: "end" as const, icon: CheckCircle2, label: "Finalizar", color: "bg-foreground" },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/30">
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
              {nodeItems.map((item) => (
                <button
                  key={item.type}
                  onClick={() => addNode(item.type)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", item.color)}>
                    <item.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </button>
              ))}
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
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
              style: { strokeWidth: 1.5, stroke: "#a1a1aa" },
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
            <div className="space-y-4">
              <div>
                <Label>Assunto do e-mail</Label>
                <Input
                  placeholder="Ex: {{nome}}, seu e-book está pronto!"
                  value={editData.subject || ""}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{{nome}}"} para inserir o nome do lead
                </p>
              </div>
              <div>
                <Label>Corpo do e-mail (HTML)</Label>
                <Textarea
                  placeholder="<h1>Olá {{nome}}!</h1><p>Seu conteúdo aqui...</p>"
                  value={editData.bodyHtml || ""}
                  onChange={(e) => setEditData({ ...editData, bodyHtml: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                />
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
