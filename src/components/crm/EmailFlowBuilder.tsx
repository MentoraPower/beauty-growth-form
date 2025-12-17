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
import { Play, Clock, Mail, CheckCircle2, Trash2, Copy, ArrowLeft, X } from "lucide-react";
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
        "px-4 py-3 rounded-lg bg-white border border-neutral-200 shadow-sm transition-all min-w-[200px]",
        selected && "ring-2 ring-neutral-400"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
          <Play className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Início</span>
          <p className="text-sm font-medium text-neutral-900">{data.label as string}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
    </div>
  );
};

// Wait Node Component
const WaitNode = ({ data, selected }: NodeProps) => {
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
        "px-4 py-3 rounded-lg bg-white border border-neutral-200 shadow-sm transition-all min-w-[200px]",
        selected && "ring-2 ring-neutral-400"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
          <Clock className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Espera</span>
          <p className="text-sm font-medium text-neutral-900">
            {waitTime} {unitLabels[waitUnit]}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
    </div>
  );
};

// Email Node Component with HTML preview
const EmailNode = ({ data, selected }: NodeProps) => {
  const subject = (data.subject as string) || "Sem assunto";
  const bodyHtml = (data.bodyHtml as string) || "";

  return (
    <div
      className={cn(
        "rounded-lg bg-white border border-neutral-200 shadow-sm transition-all w-[280px] overflow-hidden cursor-pointer",
        selected && "ring-2 ring-neutral-400"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
        <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
          <Mail className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">E-mail</span>
          <p className="text-sm font-medium text-neutral-900 truncate">{subject}</p>
        </div>
      </div>
      {/* Email preview box */}
      <div className="bg-neutral-50 border-t border-neutral-100">
        <div 
          className="p-3 h-[120px] overflow-y-auto text-xs text-neutral-600 leading-relaxed"
          style={{ fontSize: '11px' }}
        >
          {bodyHtml ? (
            <div 
              className="pointer-events-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-400 italic">
              Clique para editar o conteúdo
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
    </div>
  );
};

// End Node Component
const EndNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg bg-white border border-neutral-200 shadow-sm transition-all min-w-[200px]",
        selected && "ring-2 ring-neutral-400"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-rose-500 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Fim</span>
          <p className="text-sm font-medium text-neutral-900">{data.label as string}</p>
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

// Dashed edge style
const dashedEdgeStyle = {
  strokeWidth: 2,
  stroke: "#a3a3a3",
  strokeDasharray: "6 4",
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
  const [editPanelOpen, setEditPanelOpen] = useState(false);
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
        position: { x: 250, y: index * 200 },
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
        markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
        style: dashedEdgeStyle,
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
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
            style: dashedEdgeStyle,
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    if (node.type === "email") {
      setEditData({
        subject: node.data.subject as string,
        bodyHtml: node.data.bodyHtml as string,
      });
      setEditPanelOpen(true);
    } else if (node.type === "wait") {
      setEditData({
        waitTime: node.data.waitTime as number,
        waitUnit: node.data.waitUnit as string,
      });
      setEditDialogOpen(true);
    }
  }, []);

  const addNode = (type: "wait" | "email" | "end") => {
    const lastNode = nodes[nodes.length - 1];
    const newId = `${type}-${Date.now()}`;
    const newY = lastNode ? lastNode.position.y + 200 : 50;

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
          markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
          style: dashedEdgeStyle,
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
    setEditPanelOpen(false);
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
    setEditPanelOpen(false);
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
    <div className="flex flex-col h-full bg-neutral-100">
      {/* Header with back button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onCancel}
            className="h-9 w-9 text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{automationName}</h2>
            <p className="text-sm text-neutral-500">
              Gatilho: Lead movido para <span className="font-medium text-neutral-700">{triggerPipelineName}</span>
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          className="bg-gradient-to-r from-red-500 to-red-700 hover:opacity-90 text-white"
        >
          Salvar fluxo
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-neutral-200 bg-white">
        <span className="text-sm font-medium text-neutral-500 mr-2">Adicionar:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode("wait")}
          className="gap-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        >
          <Clock className="w-4 h-4 text-amber-500" />
          Tempo de espera
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode("email")}
          className="gap-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        >
          <Mail className="w-4 h-4 text-blue-500" />
          E-mail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode("end")}
          className="gap-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        >
          <CheckCircle2 className="w-4 h-4 text-rose-500" />
          Finalizar
        </Button>

        {selectedNode && selectedNode.type !== "start" && (
          <>
            <div className="h-6 w-px bg-neutral-300 mx-2" />
            <Button
              variant="outline"
              size="sm"
              onClick={duplicateSelectedNode}
              className="gap-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              disabled={selectedNode.type === "end"}
            >
              <Copy className="w-4 h-4" />
              Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelectedNode}
              className="gap-2 text-red-600 hover:text-red-700 border-neutral-300 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </>
        )}
      </div>

      {/* Main content area with flow and side panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Flow Canvas */}
        <div className={cn("flex-1 transition-all", editPanelOpen && "mr-[400px]")}>
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
              markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
              style: dashedEdgeStyle,
            }}
          >
            <Controls className="!bg-white !border-neutral-200 !shadow-sm !rounded-lg" />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d4" />
          </ReactFlow>
        </div>

        {/* Side Panel for Email Editing */}
        {editPanelOpen && selectedNode?.type === "email" && (
          <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-white border-l border-neutral-200 shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-semibold text-neutral-900">Editar E-mail</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditPanelOpen(false);
                  setSelectedNode(null);
                }}
                className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <Label className="text-neutral-700">Assunto do e-mail</Label>
                <Input
                  placeholder="Ex: {{nome}}, seu e-book está pronto!"
                  value={editData.subject || ""}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  className="mt-1.5 border-neutral-300 text-neutral-900"
                />
                <p className="text-xs text-neutral-500 mt-1.5">
                  Use {"{{nome}}"} para inserir o nome do lead
                </p>
              </div>

              <div className="flex-1">
                <Label className="text-neutral-700">Corpo do e-mail (HTML)</Label>
                <Textarea
                  placeholder="<h1>Olá {{nome}}!</h1><p>Seu conteúdo aqui...</p>"
                  value={editData.bodyHtml || ""}
                  onChange={(e) => setEditData({ ...editData, bodyHtml: e.target.value })}
                  className="mt-1.5 min-h-[300px] font-mono text-sm border-neutral-300 text-neutral-900"
                />
              </div>

              {/* Preview */}
              {editData.bodyHtml && (
                <div>
                  <Label className="text-neutral-700">Pré-visualização</Label>
                  <div className="mt-1.5 p-4 border border-neutral-200 rounded-lg bg-neutral-50 max-h-[200px] overflow-y-auto">
                    <div 
                      className="text-sm text-neutral-700"
                      dangerouslySetInnerHTML={{ __html: editData.bodyHtml }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-neutral-200">
              <Button 
                onClick={saveEditData} 
                className="w-full bg-gradient-to-r from-red-500 to-red-700 hover:opacity-90 text-white"
              >
                Salvar alterações
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Wait Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-neutral-900">Configurar tempo de espera</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-neutral-700">Tempo</Label>
                <Input
                  type="number"
                  min={1}
                  value={editData.waitTime || 1}
                  onChange={(e) =>
                    setEditData({ ...editData, waitTime: parseInt(e.target.value) || 1 })
                  }
                  className="border-neutral-300 text-neutral-900"
                />
              </div>
              <div>
                <Label className="text-neutral-700">Unidade</Label>
                <Select
                  value={editData.waitUnit || "hours"}
                  onValueChange={(v) => setEditData({ ...editData, waitUnit: v })}
                >
                  <SelectTrigger className="border-neutral-300 text-neutral-900">
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

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-neutral-300 text-neutral-700">
              Cancelar
            </Button>
            <Button onClick={saveEditData} className="bg-gradient-to-r from-red-500 to-red-700 text-white">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
