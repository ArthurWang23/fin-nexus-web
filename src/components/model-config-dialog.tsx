"use client";

import React, { useEffect, useState } from "react";
import { Settings, Loader2, Check, Sparkles, Brain, Search, Code, Shield, RotateCcw } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

type ModelOption = {
    provider: string;
    model_name: string;
    display_name: string;
    description: string;
    base_url: string;
};

type UserModelConfig = {
    user_id: string;
    agent_type: string;
    provider: string;
    api_key: string;
    model_name: string;
    base_url: string;
};

type AgentType = "Supervisor" | "Researcher" | "Coder";

const agentTabs: { type: AgentType; label: string; icon: React.ReactNode; description: string }[] = [
    { type: "Supervisor", label: "Supervisor", icon: <Brain size={18} />, description: "协调任务分配与决策" },
    { type: "Researcher", label: "Researcher", icon: <Search size={18} />, description: "信息搜索与研究分析" },
    { type: "Coder", label: "Coder", icon: <Code size={18} />, description: "代码生成与技术实现" },
];

const providerColors: Record<string, string> = {
    openai: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    deepseek: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    qwen: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    anthropic: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
};

const providerLabels: Record<string, string> = {
    openai: "OpenAI",
    deepseek: "DeepSeek",
    qwen: "通义千问",
    anthropic: "Anthropic",
};

interface ModelConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ModelConfigDialog({ open, onOpenChange }: ModelConfigDialogProps) {
    const [models, setModels] = useState<ModelOption[]>([]);
    const [userConfigs, setUserConfigs] = useState<Record<string, UserModelConfig>>({});
    const [selectedAgent, setSelectedAgent] = useState<AgentType>("Supervisor");
    const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (open) {
            setLoading(true);
            setError("");

            // Fetch available models
            fetch("/api/v1/models")
                .then((res) => res.json())
                .then((data) => {
                    setModels(Array.isArray(data) ? data : []);
                })
                .catch(() => setError("无法加载模型列表"));

            // Fetch user configs
            const token = localStorage.getItem("fin-nexus-token");
            if (token) {
                fetch("/api/v1/config", {
                    headers: { Authorization: `Bearer ${token}` },
                })
                    .then((res) => res.json())
                    .then((data) => {
                        if (Array.isArray(data)) {
                            const configMap: Record<string, UserModelConfig> = {};
                            data.forEach((cfg: UserModelConfig) => {
                                configMap[cfg.agent_type] = cfg;
                            });
                            setUserConfigs(configMap);
                        }
                    })
                    .catch(() => { });
            }
            setLoading(false);
        }
    }, [open]);

    // Update selected model and API key when agent type changes
    useEffect(() => {
        const config = userConfigs[selectedAgent];
        if (config && config.model_name) {
            const model = models.find((m) => m.model_name === config.model_name);
            setSelectedModel(model || null);
            setApiKey(config.api_key || "");
        } else {
            setSelectedModel(null);
            setApiKey("");
        }
    }, [selectedAgent, userConfigs, models]);

    const handleSave = async () => {
        if (!selectedModel) {
            setError("请先选择一个模型");
            return;
        }
        if (!apiKey.trim()) {
            setError("请输入 API Key");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        const token = localStorage.getItem("fin-nexus-token");
        try {
            const res = await fetch("/api/v1/config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    agent_type: selectedAgent,
                    provider: selectedModel.provider,
                    api_key: apiKey,
                    model_name: selectedModel.model_name,
                    base_url: selectedModel.base_url,
                }),
            });

            if (!res.ok) throw new Error("保存失败");

            setSuccess("配置已保存");
            // Update local state
            setUserConfigs((prev) => ({
                ...prev,
                [selectedAgent]: {
                    user_id: "",
                    agent_type: selectedAgent,
                    provider: selectedModel.provider,
                    api_key: apiKey,
                    model_name: selectedModel.model_name,
                    base_url: selectedModel.base_url,
                },
            }));
        } catch {
            setError("保存配置失败");
        } finally {
            setSaving(false);
        }
    };

    // 使用默认配置（删除用户配置）
    const handleUseDefault = async () => {
        setSaving(true);
        setError("");
        setSuccess("");

        const token = localStorage.getItem("fin-nexus-token");
        try {
            const res = await fetch(`/api/v1/config?agent_type=${selectedAgent}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) throw new Error("删除失败");

            setSuccess("已恢复默认配置");
            // Clear local state for this agent
            setUserConfigs((prev) => {
                const newConfigs = { ...prev };
                delete newConfigs[selectedAgent];
                return newConfigs;
            });
            setSelectedModel(null);
            setApiKey("");
        } catch {
            setError("恢复默认配置失败");
        } finally {
            setSaving(false);
        }
    };

    // Group models by provider
    const modelsByProvider = models.reduce((acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = [];
        acc[model.provider].push(model);
        return acc;
    }, {} as Record<string, ModelOption[]>);

    const currentConfig = userConfigs[selectedAgent];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] bg-black/90 backdrop-blur-xl border-white/10 text-white p-0 overflow-hidden flex flex-col">
                <DialogHeader className="p-6 pb-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/20 text-blue-400">
                            <Settings size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">模型配置</DialogTitle>
                            <p className="text-sm text-gray-400">为不同 Agent 配置 AI 模型</p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Agent Type Tabs */}
                <div className="border-b border-white/10 bg-white/5 shrink-0">
                    <div className="flex p-3 px-6 gap-2">
                        {agentTabs.map((tab) => (
                            <button
                                key={tab.type}
                                onClick={() => setSelectedAgent(tab.type)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedAgent === tab.type
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                                    : "text-gray-400 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="px-6 pb-3">
                        <p className="text-xs text-gray-500">
                            {agentTabs.find((t) => t.type === selectedAgent)?.description}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <Loader2 className="animate-spin text-blue-500" size={40} />
                            <p className="text-gray-400">加载模型列表...</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 h-full">
                            <div className="p-6 max-w-3xl mx-auto space-y-6 pb-4">
                                {/* Current Config Badge */}
                                {currentConfig && currentConfig.model_name && (
                                    <div className="flex items-center gap-2 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
                                        <Check size={16} className="text-emerald-400" />
                                        <span className="text-emerald-300">
                                            当前配置: {currentConfig.model_name} ({providerLabels[currentConfig.provider] || currentConfig.provider})
                                        </span>
                                    </div>
                                )}

                                {/* Models by Provider */}
                                {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                                    <div key={provider} className="space-y-3">
                                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                                            {providerLabels[provider] || provider}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {providerModels.map((model) => (
                                                <Card
                                                    key={model.model_name}
                                                    onClick={() => setSelectedModel(model)}
                                                    className={`cursor-pointer p-4 bg-gradient-to-br border transition-all duration-200 ${providerColors[provider] || "from-gray-500/20 to-gray-600/10 border-gray-500/30"
                                                        } ${selectedModel?.model_name === model.model_name
                                                            ? "ring-2 ring-blue-500 scale-[1.02]"
                                                            : "hover:scale-[1.01] hover:border-white/20"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h4 className="font-semibold text-white">{model.display_name}</h4>
                                                            <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                                                            <p className="text-xs text-gray-600 mt-2 font-mono">{model.model_name}</p>
                                                        </div>
                                                        {selectedModel?.model_name === model.model_name && (
                                                            <div className="p-1 bg-blue-500 rounded-full">
                                                                <Check size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* Footer with API Key input and Save button - outside scrollable area */}
                <div className="p-6 border-t border-white/10 bg-black/40 shrink-0">
                    <div className="max-w-3xl mx-auto space-y-4">
                        {selectedModel && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Sparkles size={14} className="text-blue-400" />
                                已选择: <span className="text-white font-medium">{selectedModel.display_name}</span>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <Input
                                type="password"
                                placeholder={`输入 ${selectedModel ? providerLabels[selectedModel.provider] || selectedModel.provider : ""} API Key`}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                            />
                            <Button
                                onClick={handleSave}
                                disabled={!selectedModel || !apiKey.trim() || saving}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 shadow-lg shadow-blue-900/30 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : "保存配置"}
                            </Button>
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        {success && <p className="text-sm text-emerald-400">{success}</p>}

                        {/* Default Config Button */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <Button
                                variant="ghost"
                                onClick={handleUseDefault}
                                disabled={saving || !userConfigs[selectedAgent]}
                                className="text-gray-400 hover:text-white hover:bg-white/10 gap-2"
                            >
                                <RotateCcw size={14} />
                                使用默认配置
                            </Button>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Shield size={12} className="text-emerald-500/70" />
                                <span>您提供的 API Key 经过加密存储，请放心使用</span>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
