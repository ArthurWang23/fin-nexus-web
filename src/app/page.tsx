"use client";

import * as React from "react";
import { Send, Square, Bot, User, Menu, Plus, LogOut, Sparkles, Newspaper, ChevronDown, ChevronUp, BrainCircuit, Settings } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { MorningBriefDialog } from "@/components/morning-brief-dialog";
import { ModelConfigDialog } from "@/components/model-config-dialog";

import { useFinNexus } from "@/hooks/use-fin-nexus";
import { useEffect, useState } from "react";

// 定义消息类型 (Matching hook)
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export default function ChatPage() {
  const { messages, status, thinkingSteps, sessions, currentSessionId, fetchSessions, loadSession, startNewSession, sendMessage, cancelWorkflow } = useFinNexus();
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showBrief, setShowBrief] = React.useState(false);
  const [showModelConfig, setShowModelConfig] = React.useState(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = React.useState(true);
  const router = useRouter();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps, status]);

  // Auto-expand when thinking, collapse when streaming starts
  useEffect(() => {
    if (status === "thinking") {
      setIsThinkingExpanded(true);
    } else if (status === "streaming" || status === "connected") {
      setIsThinkingExpanded(false);
    }
  }, [status]);

  useEffect(() => {
    // Auth Check
    const token = localStorage.getItem("fin-nexus-token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    // Load sessions
    fetchSessions(token).then(() => {
      // Optional: Load most recent session? 
      // For now, let user pick or start new if empty.
    });

    // Auto-show Morning Brief if new version available
    fetch("/api/v1/brief/version")
      .then(res => res.json())
      .then(data => {
        const serverVersion = data.version;
        const dismissedVersion = localStorage.getItem("fin-nexus-brief-dismissed-version");
        if (serverVersion && serverVersion !== dismissedVersion) {
          setShowBrief(true);
        }
      })
      .catch(() => { }); // Silently fail if version API unavailable
  }, [router, fetchSessions]);

  useEffect(() => {
    setIsLoading(status === "thinking" || status === "streaming");
  }, [status]);

  const handleSend = () => {
    if (!input.trim()) return;

    // Ensure session exists
    if (!currentSessionId) {
      const token = localStorage.getItem("fin-nexus-token");
      if (token) {
        // Start new session and send
        startNewSession(token);
        // Need a small delay or improved hook to queue message. 
        // For this MVP, we'll auto-send after a short delay to allow WS to open.
        setTimeout(() => sendMessage(input), 1000);
      }
    } else {
      sendMessage(input);
    }
    setInput("");
  };

  const handleNewChat = () => {
    const token = localStorage.getItem("fin-nexus-token");
    if (token) startNewSession(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("fin-nexus-token");
    router.push("/auth/login");
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-neutral-200">
      <AuroraBackground className="flex h-screen w-full flex-row items-stretch">

        {/* --- Glass Sidebar --- */}
        <div className="w-72 hidden md:flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-md z-10">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Sparkles className="text-blue-400" size={24} />
              <span className="font-bold text-xl tracking-wide text-white">Fin-Nexus</span>
            </div>
            <Button className="w-full justify-start gap-2 bg-blue-600/80 hover:bg-blue-600 text-white shadow-lg shadow-blue-900/20" onClick={handleNewChat}>
              <Plus size={16} /> New Chat
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white mt-2 border border-white/5" onClick={() => setShowBrief(true)}>
              <Newspaper size={16} /> Morning Brief
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white mt-2 border border-white/5" onClick={() => setShowModelConfig(true)}>
              <Settings size={16} /> Model Settings
            </Button>
          </div>
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-1">
              {sessions.length === 0 && (
                <div className="text-neutral-500 text-sm text-center py-4 italic">No history yet</div>
              )}
              {sessions.map((session, i) => (
                <Button
                  key={session.id}
                  variant="ghost"
                  className={`w-full justify-start text-sm truncate rounded-lg transition-all ${currentSessionId === session.id
                    ? "bg-white/10 text-white font-medium"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                    }`}
                  onClick={() => {
                    const token = localStorage.getItem("fin-nexus-token");
                    if (token) loadSession(token, session.id);
                  }}
                >
                  {session.title || `Conversation ${i + 1}`}
                </Button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-white/10 space-y-2 bg-black/20">
            <div className="flex items-center gap-3 px-2 py-1">
              <Avatar className="h-8 w-8 ring-2 ring-white/10">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate font-medium text-sm text-white">User</p>
                <p className="text-xs text-neutral-500">Pro Member</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </Button>
          </div>
        </div>

        {/* --- Main Chat Area --- */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10 bg-transparent">
          {/* Header Mobile Only */}
          <header className="h-14 md:hidden border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center px-4 justify-between">
            <span className="font-semibold text-white">Fin-Nexus</span>
            <Button variant="ghost" size="icon" className="text-white">
              <Menu />
            </Button>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-hidden relative">
            <ScrollArea className="h-full p-4 md:p-8">
              <div className="max-w-4xl mx-auto space-y-8 pb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 opacity-0 animate-in fade-in duration-1000 slide-in-from-bottom-5 fill-mode-forwards" style={{ animationDelay: '0.2s', opacity: 1 }}>
                    <div className="p-4 rounded-full bg-white/5 border border-white/10 backdrop-blur">
                      <Bot size={48} className="text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white">How can I help you today?</h2>
                    <p className="text-neutral-400 max-w-md">I can analyze market trends, review earnings reports, or explain complex financial concepts.</p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 mt-1 shrink-0 ring-2 ring-white/10 shadow-lg">
                      {msg.role === "assistant" ? (
                        <AvatarFallback className="bg-black text-blue-400 border border-white/10"><Bot size={20} /></AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white"><User size={20} /></AvatarFallback>
                      )}
                    </Avatar>

                    {/* Bubble */}
                    <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-6 py-3.5 rounded-2xl shadow-xl backdrop-blur-sm ${msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white/10 border border-white/5 text-neutral-100 rounded-tl-sm"
                        }`}>
                        <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              img: ({ node, ...props }) => {
                                let src = props.src || "";
                                if (typeof src === "string" && src.startsWith("/images")) {
                                  src = `http://localhost:8080${src}`;
                                }
                                return <img {...props} src={src as string} className="max-w-full rounded-lg border border-white/10 my-3 shadow-md bg-black/20" alt="chart" />;
                              },
                              p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                              a: ({ node, ...props }) => <a className="text-blue-300 hover:text-blue-200 underline underline-offset-2" {...props} />,
                              code: ({ node, ...props }) => <code className="bg-black/30 px-1 py-0.5 rounded text-yellow-200 font-mono text-xs" {...props} />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Thinking Process Block */}
                {thinkingSteps.length > 0 && (
                  <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <Avatar className="h-10 w-10 ring-2 ring-white/10 opacity-50"><AvatarFallback className="bg-black border border-white/10"><BrainCircuit size={20} className="text-purple-400" /></AvatarFallback></Avatar>
                    <div className="w-full max-w-[85%]">
                      <div className="rounded-lg border border-purple-500/20 bg-purple-900/10 overflow-hidden">
                        <button
                          onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                          className="w-full flex items-center justify-between px-4 py-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors text-xs font-medium text-purple-300"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles size={12} />
                            Thinking Process
                          </span>
                          {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isThinkingExpanded && (
                          <div className="p-3 space-y-2 bg-black/20">
                            {thinkingSteps.map((step, idx) => (
                              <div key={idx} className="text-xs text-gray-400 font-mono pl-2 border-l-2 border-purple-500/20 animate-in fade-in">
                                {step}
                              </div>
                            ))}
                            {status === "thinking" && (
                              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse ml-2" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {status === "thinking" && (
                  <div className="flex gap-4">
                    <Avatar className="h-10 w-10 ring-2 ring-white/10"><AvatarFallback className="bg-black border border-white/10"><Bot size={20} className="text-blue-400" /></AvatarFallback></Avatar>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 rounded-tl-sm">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </ScrollArea>
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 pb-6 relative z-20">
            <div className="max-w-3xl mx-auto relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-30 group-hover:opacity-60 transition duration-500 blur"></div>
              <div className="relative flex items-end gap-2 bg-[#09090b] border border-white/10 rounded-xl p-2 shadow-2xl">
                <Input
                  className="flex-1 bg-transparent border-none text-white placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[50px] py-3 px-4 resize-none"
                  placeholder="Ask Fin-Nexus about markets, stocks, or strategies..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  autoComplete="off"
                />
                {isLoading ? (
                  <Button
                    onClick={cancelWorkflow}
                    className="mb-1 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25 transition-all duration-300"
                    size="icon"
                  >
                    <Square size={16} />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className={`mb-1 transition-all duration-300 ${input.trim()
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                      : "bg-white/10 text-neutral-500 hover:bg-white/20"
                      }`}
                    size="icon"
                  >
                    <Send size={18} />
                  </Button>
                )}
              </div>
              <div className="text-center mt-2">
                <p className="text-[10px] text-neutral-600">Fin-Nexus AI can make mistakes. Consider checking important information.</p>
              </div>
            </div>
          </div>
        </div>
      </AuroraBackground>
      <MorningBriefDialog
        open={showBrief}
        onOpenChange={(open) => {
          setShowBrief(open);
          if (!open) {
            // Record current server version when user closes the dialog
            fetch("/api/v1/brief/version")
              .then(res => res.json())
              .then(data => {
                if (data.version) {
                  localStorage.setItem("fin-nexus-brief-dismissed-version", data.version);
                }
              })
              .catch(() => { });
          }
        }}
      />
      <ModelConfigDialog open={showModelConfig} onOpenChange={setShowModelConfig} />
    </div>
  );
}