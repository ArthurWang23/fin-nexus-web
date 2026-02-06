"use client";

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge as FlowEdge,
    Node as FlowNode,
    BackgroundVariant,
    Panel,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useParams, useRouter } from 'next/navigation';
import { Save, Play, ChevronLeft, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { nodeTypes, StartNode, EndNode, LLMNode, ToolNode, RouterNode } from '@/components/blueprint-editor/custom-nodes';

// --- Types needed for conversion ---
interface NodePosition { x: number; y: number }
interface BlueprintNode {
    id: string;
    type: string;
    config: any;
    next?: string;
    position?: NodePosition;
}
interface BlueprintEdge {
    source: string;
    target: string;
    condition?: string;
}

const initialNodes: FlowNode[] = [];
const initialEdges: FlowEdge[] = [];

export default function BlueprintEditor() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [blueprintName, setBlueprintName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Load Blueprint
    useEffect(() => {
        const fetchBlueprint = async () => {
            const token = localStorage.getItem("fin-nexus-token");
            if (!token) {
                router.push("/auth/login");
                return;
            }
            try {
                const res = await fetch(`/api/v1/blueprints/${id}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();

                setBlueprintName(data.name);

                // Convert Backend Data -> React Flow
                const flowNodes: FlowNode[] = (data.nodes || []).map((n: BlueprintNode, i: number) => ({
                    id: n.id,
                    type: n.type,
                    // Wider layout: 350px spacing
                    position: n.position || { x: 100 + i * 350, y: 100 },
                    data: { config: n.config },
                }));

                const flowEdges: FlowEdge[] = (data.edges || []).map((e: BlueprintEdge, i: number) => ({
                    id: `e-${e.source}-${e.target}-${i}`,
                    source: e.source,
                    target: e.target,
                    label: e.condition && e.condition !== 'default' ? e.condition : undefined,
                    animated: true,
                    type: 'smoothstep',
                    style: { stroke: '#4f46e5' },
                    markerEnd: { type: MarkerType.ArrowClosed }
                }));

                // Synthesize edges from 'next' property
                (data.nodes || []).forEach((n: BlueprintNode) => {
                    if (n.next && n.next !== 'END') {
                        // Check if edge already exists
                        const exists = flowEdges.some(e => e.source === n.id && e.target === n.next);
                        if (!exists) {
                            flowEdges.push({
                                id: `e-next-${n.id}-${n.next}`,
                                source: n.id,
                                target: n.next,
                                label: 'next',
                                animated: true,
                                type: 'smoothstep',
                                style: { stroke: '#8b5cf6', strokeDasharray: '5,5' }, // Dashed for implicit next
                                markerEnd: { type: MarkerType.ArrowClosed }
                            });
                        }
                    }
                });

                setNodes(flowNodes);
                setEdges(flowEdges);
            } catch (err) {
                toast.error("Could not load blueprint");
            } finally {
                setLoading(false);
            }
        };
        fetchBlueprint();
    }, [id, router, setNodes, setEdges]);

    // Handle Save
    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem("fin-nexus-token");

        // Convert React Flow -> Backend Data
        const bpNodes: BlueprintNode[] = nodes.map(n => ({
            id: n.id,
            type: n.type || "LLM",
            config: n.data.config,
            position: n.position,
            // 'next' is implicitly defined by edges, but we can try to infer it for simple cases if we wanted.
            // However, our backend relies on 'edges' primarily now for execution graph.
            // We might need to keep 'next' empty or populated based on edges if strictly required by legacy logic.
            // GraphExecutionWorkflow uses 'edges' first, then 'next'. so we can leave next empty?
            // Wait, validation requires 'next' or edge? Validation logic checks edges.
        }));

        const bpEdges: BlueprintEdge[] = edges.map(e => ({
            source: e.source,
            target: e.target,
            condition: e.label as string || undefined
        }));

        try {
            const res = await fetch(`/api/v1/blueprints/${id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: blueprintName,
                    nodes: bpNodes,
                    edges: bpEdges,
                    // start_node_id: ... keep existing? usually start node doesn't change implicitly
                    // For now assume user doesn't delete the start node or we need UI to pick it.
                })
            });
            if (res.ok) {
                toast.success("Blueprint saved successfully");
            } else {
                const err = await res.json();
                toast.error(`Save failed: ${err.error}`);
            }
        } catch (err) {
            toast.error("Save failed");
        } finally {
            setSaving(false);
        }
    };

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({
        ...params,
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#6366f1', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed }
    }, eds)), [setEdges]);

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

    const updateNodeConfig = (newConfig: any) => {
        setNodes(nds => nds.map(n => {
            if (n.id === selectedNodeId) {
                return { ...n, data: { ...n.data, config: newConfig } };
            }
            return n;
        }));
    };

    const onNodeClick = (_: React.MouseEvent, node: FlowNode) => {
        setSelectedNodeId(node.id);
    };

    const onPaneClick = () => {
        setSelectedNodeId(null);
    }

    // Helper to add node
    const addNode = (type: string) => {
        const id = `${type.toLowerCase()}-${nodes.length + 1}`;
        const newNode: FlowNode = {
            id,
            type,
            position: { x: 250, y: 5 },
            data: { config: {} },
        };
        // Default configs
        if (type === 'LLM') {
            newNode.data.config = { model_name: 'gpt-4o', template: 'Response for {{input}}', system_prompt: 'You are a helpful assistant.' };
        } else if (type === 'Tool') {
            newNode.data.config = { tool_name: 'researcher', input_template: '{{input}}' };
        } else if (type === 'Router') {
            newNode.data.config = { prompt: 'Classify intent', choices: ['a', 'b'] };
        }

        setNodes(nds => nds.concat(newNode));
    };


    if (loading) return <div className="flex h-screen items-center justify-center bg-black text-white"><Loader2 className="animate-spin mr-2" /> Loading Editor...</div>;

    return (
        <div className="w-full h-screen flex flex-col bg-black text-neutral-200">
            {/* Toolbar */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/blueprints')}>
                        <ChevronLeft />
                    </Button>
                    <Input
                        className="bg-transparent border-none text-lg font-medium text-white focus-visible:ring-0 w-64"
                        value={blueprintName}
                        onChange={e => setBlueprintName(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5" onClick={() => addNode('LLM')}><Plus size={14} className="mr-1" /> LLM</Button>
                    <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5" onClick={() => addNode('Tool')}><Plus size={14} className="mr-1" /> Tool</Button>
                    <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5" onClick={() => addNode('Router')}><Plus size={14} className="mr-1" /> Router</Button>
                    <div className="w-4" />
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                        {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                        Save
                    </Button>
                </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 h-full relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        colorMode="dark"
                        fitView
                    >
                        <Background color="#333" gap={24} variant={BackgroundVariant.Dots} />
                        <Controls className="bg-[#18181b] border border-white/10 text-white fill-white [&>button]:fill-white [&>button:hover]:bg-white/10" />
                        <MiniMap
                            className='border border-white/10 shadow-xl rounded-lg overflow-hidden'
                            style={{ backgroundColor: '#18181b', height: 120, width: 200 }}
                            nodeColor={(n) => {
                                if (n.type === 'Start') return '#22c55e'; // Green
                                if (n.type === 'End') return '#ef4444'; // Red
                                if (n.type === 'LLM') return '#3b82f6'; // Blue
                                if (n.type === 'Tool') return '#f97316'; // Orange
                                if (n.type === 'Router') return '#a855f7'; // Purple
                                return '#525252';
                            }}
                            maskColor="rgba(0, 0, 0, 0.6)"
                        />
                    </ReactFlow>
                </div>

                {/* Right Sidebar */}
                {selectedNode && (
                    <div className="w-80 border-l border-white/10 bg-black/50 backdrop-blur-md p-4 overflow-y-auto absolute right-0 top-0 bottom-0 z-10 transition-transform">
                        <div className="mb-4 pb-4 border-b border-white/10">
                            <h3 className="text-lg font-semibold text-white">{selectedNode.type} Node Settings</h3>
                            <p className="text-xs text-neutral-500 font-mono">ID: {selectedNode.id}</p>
                        </div>

                        <div className="space-y-4">
                            {/* LLM Config Form */}
                            {selectedNode.type === 'LLM' && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Model</Label>
                                        <Select
                                            value={(selectedNode.data.config as any)?.llm_config?.model_name || "gpt-4o"}
                                            onValueChange={v => updateNodeConfig({ ...(selectedNode.data.config as any), llm_config: { ...((selectedNode.data.config as any)?.llm_config), model_name: v } })}
                                        >
                                            <SelectTrigger className="bg-white/5 border-white/10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                                                <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                                                <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                                                <SelectItem value="deepseek-chat">DeepSeek V3.2</SelectItem>
                                                <SelectItem value="deepseek-reasoner">DeepSeek V3.2 (Reasoning)</SelectItem>
                                                <SelectItem value="qwen3-max">Qwen3 Max</SelectItem>
                                                <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API Key <span className="text-neutral-500 font-normal">(Optional)</span></Label>
                                        <Input
                                            type="password"
                                            className={`bg-white/5 border-white/10 ${(selectedNode.data.config as any)?.llm_config?.api_key === "••••••••" ? "text-green-400 placeholder:text-green-400/50" : ""}`}
                                            value={(selectedNode.data.config as any)?.llm_config?.api_key || ""}
                                            onChange={e => updateNodeConfig({
                                                ...(selectedNode.data.config as any),
                                                llm_config: {
                                                    ...((selectedNode.data.config as any)?.llm_config),
                                                    api_key: e.target.value
                                                }
                                            })}
                                            onFocus={e => {
                                                // 如果是掩码值，清空以便输入新值
                                                if (e.target.value === "••••••••") {
                                                    updateNodeConfig({
                                                        ...(selectedNode.data.config as any),
                                                        llm_config: {
                                                            ...((selectedNode.data.config as any)?.llm_config),
                                                            api_key: ""
                                                        }
                                                    });
                                                }
                                            }}
                                            placeholder="sk-..."
                                        />
                                        {(selectedNode.data.config as any)?.llm_config?.api_key === "••••••••" && (
                                            <p className="text-[10px] text-green-400">✓ API Key 已配置（点击输入框可更换）</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>System Prompt</Label>
                                        <Textarea
                                            className="bg-white/5 border-white/10 min-h-[100px]"
                                            value={(selectedNode.data.config as any)?.system_prompt || ""}
                                            onChange={e => updateNodeConfig({ ...(selectedNode.data.config as any), system_prompt: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>User Template</Label>
                                        <Textarea
                                            className="bg-white/5 border-white/10 font-mono text-xs"
                                            value={(selectedNode.data.config as any)?.template || ""}
                                            onChange={e => updateNodeConfig({ ...(selectedNode.data.config as any), template: e.target.value })}
                                            placeholder="Explain {{input}}..."
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Streaming</Label>
                                        <Switch
                                            checked={(selectedNode.data.config as any)?.streaming}
                                            onCheckedChange={c => updateNodeConfig({ ...(selectedNode.data.config as any), streaming: c })}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Tool Config Form */}
                            {selectedNode.type === 'Tool' && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Tool Name</Label>
                                        <Select
                                            value={(selectedNode.data.config as any)?.tool_name || "researcher"}
                                            onValueChange={v => updateNodeConfig({ ...(selectedNode.data.config as any), tool_name: v })}
                                        >
                                            <SelectTrigger className="bg-white/5 border-white/10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="researcher">Researcher (Web Search)</SelectItem>
                                                <SelectItem value="coder">Coder (Python)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Input Template</Label>
                                        <Textarea
                                            className="bg-white/5 border-white/10 font-mono text-xs"
                                            value={(selectedNode.data.config as any)?.input_template || ""}
                                            onChange={e => updateNodeConfig({ ...(selectedNode.data.config as any), input_template: e.target.value })}
                                        />
                                        <p className="text-[10px] text-neutral-500">Use {"{{input}}"} to pass previous output.</p>
                                    </div>
                                </>
                            )}

                            {/* Router Config Form */}
                            {selectedNode.type === 'Router' && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Decision Prompt</Label>
                                        <Textarea
                                            className="bg-white/5 border-white/10"
                                            value={(selectedNode.data.config as any)?.prompt || ""}
                                            onChange={e => updateNodeConfig({ ...(selectedNode.data.config as any), prompt: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Choices (comma separated)</Label>
                                        <Input
                                            className="bg-white/5 border-white/10"
                                            value={((selectedNode.data.config as any)?.choices || []).join(",")}
                                            onChange={e => updateNodeConfig({ ...(selectedNode.data.config as any), choices: e.target.value.split(",").map(s => s.trim()) })}
                                        />
                                        <p className="text-[10px] text-neutral-500">Each choice is an output port.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
