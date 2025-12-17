import { useState, useCallback, useMemo } from "react";
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
import { Play, Clock, Mail, CheckCircle2, Trash2, Copy, GripVertical, X, Plus } from "lucide-react";
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
        "px-4 py-3 rounded-xl border-2 bg-white shadow-lg transition-all min-w-[180px]",
        selected ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-emerald-300"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md">
          <Play className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Início</span>
          <p className="text-sm font-semibold text-foreground">{data.label as string}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
    </div>
  );
};

// Wait Node Component
const WaitNode = ({ data, selected, id }: NodeProps) => {
  const waitTime = (data.waitTime as number) || 1;
  const waitUnit = (data.waitUnit as string) || "hours";
  const unitLabels: Record<string, string> = {
    minutes: "minutos",
    hours: "horas",
    days: "dias",
    months: "meses",
  };

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl border-2 bg-white shadow-lg transition-all min-w-[180px]",
        selected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-amber-300"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs text-amber-600 font-medium uppercase tracking-wide">Espera</span>
          <p className="text-sm font-semibold text-foreground">
            {waitTime} {unitLabels[waitUnit]}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
    </div>
  );
};

// Email Node Component
const EmailNode = ({ data, selected }: NodeProps) => {
  const subject = (data.subject as string) || "Sem assunto";

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl border-2 bg-white shadow-lg transition-all min-w-[200px] max-w-[250px]",
        selected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-blue-300"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">E-mail</span>
          <p className="text-sm font-semibold text-foreground truncate">{subject}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
};

// End Node Component
const EndNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl border-2 bg-white shadow-lg transition-all min-w-[180px]",
        selected ? "border-rose-500 ring-2 ring-rose-500/20" : "border-rose-300"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs text-rose-600 font-medium uppercase tracking-wide">Fim</span>
          <p className="text-sm font-semibold text-foreground">{data.label as string}</p>
        </div>
      </div>
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
        position: { x: 250, y: index * 150 },
        data: step.data,
      }))
    : [
        {
          id: "start-1",
          type: "start",
          position: { x: 250, y: 50 },
          data: { label: "Automação iniciada" },
        },
      ];

  const initialEdges: Edge[] = initialSteps?.length
    ? initialSteps.slice(0, -1).map((step, index) => ({
        id: `e-${step.id}-${initialSteps[index + 1].id}`,
        source: step.id,
        target: initialSteps[index + 1].id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: "#94a3b8" },
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
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2, stroke: "#94a3b8" },
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
    const newY = lastNode ? lastNode.position.y + 150 : 50;

    const defaultData: Record<string, any> = {
      wait: { label: "Tempo de espera", waitTime: 1, waitUnit: "hours" },
      email: { label: "Enviar e-mail", subject: "", bodyHtml: "" },
      end: { label: "Fluxo finalizado" },
    };

    const newNode: Node = {
      id: newId,
      type,
      position: { x: 250, y: newY },
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
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2, stroke: "#94a3b8" },
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
        y: selectedNode.position.y + 50,
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{automationName}</h2>
          <p className="text-sm text-muted-foreground">
            Gatilho: Lead movido para <span className="font-medium">{triggerPipelineName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
            Salvar fluxo
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background">
        <span className="text-sm font-medium text-muted-foreground mr-2">Adicionar:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode("wait")}
          className="gap-2"
        >
          <Clock className="w-4 h-4 text-amber-500" />
          Tempo de espera
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode("email")}
          className="gap-2"
        >
          <Mail className="w-4 h-4 text-blue-500" />
          E-mail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode("end")}
          className="gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-rose-500" />
          Finalizar
        </Button>

        {selectedNode && selectedNode.type !== "start" && (
          <>
            <div className="h-6 w-px bg-border mx-2" />
            <Button
              variant="outline"
              size="sm"
              onClick={duplicateSelectedNode}
              className="gap-2"
              disabled={selectedNode.type === "end"}
            >
              <Copy className="w-4 h-4" />
              Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelectedNode}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </>
        )}
      </div>

      {/* Flow Canvas */}
      <div className="flex-1 bg-muted/20">
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
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2, stroke: "#94a3b8" },
          }}
        >
          <Controls className="!bg-white !border-border !shadow-lg" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        </ReactFlow>
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
            <Button onClick={saveEditData}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
