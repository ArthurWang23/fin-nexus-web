"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, X, Sparkles } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

type MorningBrief = {
    id: string;
    ticker: string;
    date: string;
    report: string;
    price_change: number;
    has_news: boolean;
};

interface MorningBriefDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    token?: string; // Optional auth token if needed, though endpoint is public for now
}

export function MorningBriefDialog({ open, onOpenChange }: MorningBriefDialogProps) {
    const [briefs, setBriefs] = useState<MorningBrief[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedDate, setSelectedDate] = useState<string>("");

    // Generate last 30 days
    const dates = React.useMemo(() => {
        const list = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            // Format: "Mon, Jan 1"
            const displayStr = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' });
            list.push({ value: dateStr, label: displayStr });
        }
        return list;
    }, []);

    useEffect(() => {
        if (open) {
            setLoading(true);
            setBriefs([]); // Clear previous data while loading to show feedback

            const url = selectedDate ? `/api/v1/brief?date=${selectedDate}` : "/api/v1/brief";

            fetch(url)
                .then((res) => {
                    if (!res.ok) throw new Error("Failed to fetch brief");
                    return res.json();
                })
                .then((data) => {
                    setBriefs(Array.isArray(data) ? data : []);
                    setLoading(false); // Move here to avoid flash if fast
                })
                .catch((err) => {
                    setError(err.message);
                    setLoading(false);
                });
        }
    }, [open, selectedDate]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] bg-black/80 backdrop-blur-xl border-white/10 text-white p-0 overflow-hidden flex flex-col">
                <DialogHeader className="p-6 pb-4 border-b border-white/10 flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/20 text-blue-400">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Morning Brief</DialogTitle>
                            <p className="text-sm text-gray-400">Daily Market Intelligence</p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Date Picker Bar */}
                <div className="border-b border-white/10 bg-white/5 shrink-0 relative z-20">
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex w-max space-x-2 p-3 px-6">
                            <Button
                                variant={selectedDate === "" ? "secondary" : "ghost"}
                                onClick={() => setSelectedDate("")}
                                className={`rounded-full h-8 text-xs ${selectedDate === "" ? "bg-white text-black hover:bg-white/90" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
                            >
                                Latest
                            </Button>
                            {dates.map((d) => (
                                <Button
                                    key={d.value}
                                    variant={selectedDate === d.value ? "secondary" : "ghost"}
                                    onClick={() => setSelectedDate(d.value)}
                                    className={`rounded-full h-8 text-xs ${selectedDate === d.value ? "bg-blue-600 text-white hover:bg-blue-500" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
                                >
                                    {d.label}
                                </Button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" className="h-2.5" />
                    </ScrollArea>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {/* Optional background effect */}
                    <div className="absolute inset-0 bg-blue-900/10 pointer-events-none" />

                    <ScrollArea className="h-full p-6 md:p-10">
                        {loading && (
                            <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-in fade-in duration-500">
                                <Loader2 className="animate-spin text-blue-500" size={40} />
                                <p className="text-gray-400">Analyzing market data for {selectedDate || "today"}...</p>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="text-center text-red-400 py-10 bg-red-500/10 rounded-xl m-4 border border-red-500/20">
                                {error}
                            </div>
                        )}

                        {!loading && !error && briefs.length > 0 && (
                            <div className="space-y-8 max-w-3xl mx-auto">
                                {briefs.map((brief) => (
                                    <div key={brief.id} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-2xl font-semibold text-blue-300 tracking-tight">{brief.ticker || "Market Summary"}</h2>
                                            <span className="text-sm text-gray-500 font-mono bg-white/5 px-2 py-1 rounded">{brief.date}</span>
                                        </div>

                                        {brief.price_change !== 0 && (
                                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${brief.price_change >= 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                                {brief.price_change >= 0 ? '↗' : '↘'} {Math.abs(brief.price_change)}% 24h
                                            </div>
                                        )}

                                        <Card className="bg-black/40 border-white/5 p-6 backdrop-blur-sm">
                                            <div className="prose prose-invert prose-blue max-w-none text-gray-300 prose-p:text-gray-300 prose-headings:text-white prose-strong:text-white prose-a:text-blue-400 prose-li:text-gray-300 prose-ul:text-gray-300">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {brief.report}
                                                </ReactMarkdown>
                                            </div>
                                        </Card>
                                        <Separator className="my-8 bg-blue-500/20" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && !error && briefs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                                <div className="p-3 bg-white/5 rounded-full">
                                    <Sparkles className="text-gray-500" size={32} />
                                </div>
                                <div className="text-gray-400">
                                    No briefing available for {selectedDate || "today"}.<br />
                                    <span className="text-sm text-gray-600">Our agents are still sleeping or market was closed.</span>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}


