"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, BrainCircuit, Search, MoreHorizontal, Copy, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Blueprint {
    id: string;
    name: string;
    description: string;
    updated_at: string;
    nodes: any[];
    is_public: boolean;
}

export default function BlueprintsPage() {
    const router = useRouter();
    const [blueprints, setBlueprints] = React.useState<Blueprint[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetchBlueprints();
    }, []);

    const fetchBlueprints = async () => {
        const token = localStorage.getItem("fin-nexus-token");
        if (!token) {
            router.push("/auth/login");
            return;
        }

        try {
            const res = await fetch("/api/v1/blueprints", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBlueprints(data || []);
            }
        } catch (err) {
            toast.error("Failed to load bluerprints");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        const token = localStorage.getItem("fin-nexus-token");
        if (!token) return;

        try {
            // Create a default empty blueprint
            const res = await fetch("/api/v1/blueprints", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: "New Blueprint",
                    description: "Describe your workflow...",
                    start_node_id: "start-1",
                    nodes: [
                        { id: "start-1", type: "Start", config: {}, next: "end-1" },
                        { id: "end-1", type: "End", config: {} }
                    ],
                    edges: [
                        { source: "start-1", target: "end-1" }
                    ],
                    is_public: false
                })
            });

            if (res.ok) {
                const newBp = await res.json();
                toast.success("Blueprint created");
                router.push(`/blueprints/${newBp.id}`);
            } else {
                const err = await res.json();
                toast.error(err.error || "Creation failed");
            }
        } catch (error) {
            toast.error("Failed to create blueprint");
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this blueprint?")) return;

        const token = localStorage.getItem("fin-nexus-token");
        try {
            const res = await fetch(`/api/v1/blueprints/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Blueprint deleted");
                setBlueprints(prev => prev.filter(b => b.id !== id));
            }
        } catch (error) {
            toast.error("Delete failed");
        }
    };

    const filtered = blueprints.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="relative w-full h-screen overflow-hidden text-neutral-200 bg-black">
            <AuroraBackground className="flex h-screen w-full flex-col p-6 md:p-12 overflow-y-auto">
                <div className="max-w-6xl w-full mx-auto space-y-8 relative z-10">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <BrainCircuit className="text-blue-500" /> Workflow Blueprints
                            </h1>
                            <p className="text-neutral-400 mt-2">Design, automate, and share your AI agent workflows.</p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={() => router.push('/')}>
                                Back to Chat
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20" onClick={handleCreate}>
                                <Plus size={18} className="mr-2" /> New Blueprint
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <Input
                            placeholder="Search blueprints..."
                            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-blue-500/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Grid */}
                    {loading ? (
                        <div className="text-center py-20 text-neutral-500 animate-pulse">Loading blueprints...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-white/5">
                            <BrainCircuit size={48} className="mx-auto text-neutral-600 mb-4" />
                            <h3 className="text-lg font-medium text-white">No blueprints found</h3>
                            <p className="text-neutral-500 mb-6">Get started by creating your first workflow.</p>
                            <Button onClick={handleCreate} className="bg-white/10 hover:bg-white/20 text-white">Create Blueprint</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filtered.map(bp => (
                                <Card
                                    key={bp.id}
                                    className="bg-black/40 border-white/10 backdrop-blur-sm hover:border-blue-500/50 transition-all cursor-pointer group"
                                    onClick={() => router.push(`/blueprints/${bp.id}`)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors truncate pr-4">
                                                {bp.name}
                                            </CardTitle>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-white -mt-1 -mr-2">
                                                        <MoreHorizontal size={16} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-[#18181b] border-white/10 text-neutral-200">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/blueprints/${bp.id}`); }}>
                                                        <Edit size={14} className="mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-400 focus:text-red-300" onClick={(e) => handleDelete(bp.id, e)}>
                                                        <Trash2 size={14} className="mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardDescription className="line-clamp-2 text-neutral-400 h-10">
                                            {bp.description || "No description provided."}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
                                            <span className="bg-white/5 px-2 py-1 rounded">{bp.nodes?.length || 0} Nodes</span>
                                            <span className="bg-white/5 px-2 py-1 rounded">{bp.is_public ? "Public" : "Private"}</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-0 text-xs text-neutral-600 border-t border-white/5 mt-4 pt-4 flex justify-between">
                                        <span>Last updated {bp.updated_at ? formatDistanceToNow(new Date(bp.updated_at), { addSuffix: true }) : "recently"}</span>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </AuroraBackground>
        </div>
    );
}
