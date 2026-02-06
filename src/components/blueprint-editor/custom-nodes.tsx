import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Play, Flag, GitFork, Wrench } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Shared Node wrapper for consistent style
const BaseNode = ({
    children,
    title,
    icon: Icon,
    selected,
    borderColor = "border-white/10"
}: {
    children?: React.ReactNode,
    title: string,
    icon: any,
    selected?: boolean,
    borderColor?: string
}) => (
    <Card className={`w-[250px] bg-black/80 backdrop-blur-md border ${selected ? "border-blue-500 ring-2 ring-blue-500/20" : borderColor} shadow-xl transition-all`}>
        <CardHeader className="p-3 pb-2 border-b border-white/5 flex flex-row items-center gap-2 space-y-0">
            <div className={`p-1.5 rounded-md ${selected ? "bg-blue-600" : "bg-white/10"}`}>
                <Icon size={14} className="text-white" />
            </div>
            <CardTitle className="text-sm font-medium text-neutral-200 truncate">
                {title}
            </CardTitle>
        </CardHeader>
        {children && <CardContent className="p-3 text-xs text-neutral-400">{children}</CardContent>}
    </Card>
);

export const StartNode = ({ selected }: NodeProps) => (
    <>
        <BaseNode title="Start" icon={Play} selected={selected} borderColor="border-green-500/50">
            <p>Initial Input</p>
        </BaseNode>
        <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
    </>
);

export const EndNode = ({ selected }: NodeProps) => (
    <>
        <Handle type="target" position={Position.Left} className="!bg-red-500 !w-3 !h-3" />
        <BaseNode title="End" icon={Flag} selected={selected} borderColor="border-red-500/50">
            <p>Workflow Output</p>
        </BaseNode>
    </>
);

export const LLMNode = ({ data, selected }: NodeProps) => (
    <>
        <Handle type="target" position={Position.Left} className="!bg-blue-500" />
        <BaseNode title="LLM Generation" icon={Bot} selected={selected} borderColor="border-blue-500/30">
            <div className="space-y-1">
                <div className="font-mono text-[10px] text-blue-300 bg-blue-900/20 px-1 py-0.5 rounded truncate">
                    {typeof data.config === 'object' && (data.config as any)?.llm_config?.model_name || "Default Model"}
                </div>
                <p className="line-clamp-2 italic opacity-70">
                    {(data.config as any)?.template || "No template set"}
                </p>
            </div>
        </BaseNode>
        <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    </>
);

export const ToolNode = ({ data, selected }: NodeProps) => (
    <>
        <Handle type="target" position={Position.Left} className="!bg-orange-500" />
        <BaseNode title="Tool Execution" icon={Wrench} selected={selected} borderColor="border-orange-500/30">
            <div className="space-y-1">
                <div className="font-mono text-[10px] text-orange-300 bg-orange-900/20 px-1 py-0.5 rounded uppercase">
                    {(data.config as any)?.tool_name || "SELECT TOOL"}
                </div>
            </div>
        </BaseNode>
        <Handle type="source" position={Position.Right} className="!bg-orange-500" />
    </>
);

export const RouterNode = ({ data, selected }: NodeProps) => {
    const choices = (data.config as any)?.choices || ["default"];
    return (
        <>
            <Handle type="target" position={Position.Left} className="!bg-purple-500" />
            <BaseNode title="Router" icon={GitFork} selected={selected} borderColor="border-purple-500/30">
                <p className="mb-2 italic opacity-70 line-clamp-3">{(data.config as any)?.prompt || "Condition..."}</p>
                <div className="flex flex-col gap-1 items-end pt-2 border-t border-white/5">
                    {choices.map((choice: string, i: number) => (
                        <div key={i} className="relative w-full text-right h-5 flex items-center justify-end">
                            <span className="text-[10px] text-purple-300 mr-2">{choice}</span>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={choice}
                                style={{ top: '50%', right: '-16px', transform: 'translateY(-50%)' }}
                                className="!bg-purple-500 !w-2 !h-2"
                            />
                        </div>
                    ))}
                </div>
            </BaseNode>
        </>
    );
};

export const nodeTypes = {
    Start: StartNode,
    End: EndNode,
    LLM: LLMNode,
    Tool: ToolNode,
    Router: RouterNode,
};
