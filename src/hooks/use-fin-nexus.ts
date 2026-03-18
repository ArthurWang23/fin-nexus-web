import { useState, useRef, useCallback } from 'react';

export type Message = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    created_at?: string;
};

export type Session = {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
};

export type PendingApproval = {
    code: string;
};

export type PlanStep = {
    id: number;
    agent: string;
    instruction: string;
    depends_on: number[];
    status: "pending" | "running" | "done" | "error";
};

export type ExecutionPlan = {
    thought: string;
    steps: PlanStep[];
} | null;

export function useFinNexus() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [status, setStatus] = useState<"idle" | "connected" | "thinking" | "streaming" | "awaiting_approval">("idle");
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
    const [agentOutputs, setAgentOutputs] = useState<string[]>([]);
    const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
    const [executionPlan, setExecutionPlan] = useState<ExecutionPlan>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const responseBuffer = useRef("");
    const tokenRef = useRef<string | null>(null);

    const fetchSessions = useCallback(async (token: string) => {
        try {
            const res = await fetch("/api/v1/sessions", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data || []);
            }
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        }
    }, []);

    const loadSession = useCallback(async (token: string, sessionId: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        setCurrentSessionId(sessionId);
        setMessages([]);
        setThinkingSteps([]);
        setPendingApproval(null);
        setStatus("idle");

        try {
            const res = await fetch(`/api/v1/sessions/${sessionId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const history: Message[] = await res.json();
                setMessages(history.map(m => ({
                    ...m,
                    role: m.role as "user" | "assistant" | "system"
                })));
            }
        } catch (e) {
            console.error("Failed to load session history", e);
        }

        connect(token, sessionId);
    }, []);

    const startNewSession = useCallback((token: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        const newId = crypto.randomUUID();
        setCurrentSessionId(newId);
        setMessages([]);
        setThinkingSteps([]);
        setPendingApproval(null);
        setStatus("idle");
        connect(token, newId);
        return newId;
    }, []);

    const connect = useCallback((token: string, sessionId: string) => {
        tokenRef.current = token;

        const sseBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const es = new EventSource(`${sseBase}/api/v1/stream?token=${token}&session_id=${sessionId}`);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "connected") {
                    setStatus("connected");
                }
                else if (data.type === "step") {
                    setStatus("thinking");
                    setThinkingSteps((prev) => [...prev, data.content]);
                }
                else if (data.type === "token") {
                    setStatus("streaming");
                    responseBuffer.current += data.content;

                    setMessages((prev) => {
                        const lastMsg = prev[prev.length - 1];
                        if (!lastMsg || lastMsg.role === "user") {
                            return [...prev, { id: Date.now().toString(), role: "assistant", content: responseBuffer.current }];
                        }
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1] = {
                            ...newHistory[newHistory.length - 1],
                            content: responseBuffer.current,
                        };
                        return newHistory;
                    });
                }
                else if (data.type === "agent_output") {
                    setStatus("streaming");
                    setAgentOutputs((prev) => [...prev, data.content]);
                }
                else if (data.type === "plan") {
                    try {
                        const plan = JSON.parse(data.content);
                        setExecutionPlan({
                            thought: plan.thought,
                            steps: plan.steps.map((s: any) => ({ ...s, status: "pending" as const })),
                        });
                    } catch (e) {
                        console.error("Failed to parse plan", e);
                    }
                }
                else if (data.type === "step_complete") {
                    try {
                        const info = JSON.parse(data.content);
                        setExecutionPlan((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                steps: prev.steps.map((s) =>
                                    s.id === info.id ? { ...s, status: info.status } : s
                                ),
                            };
                        });
                    } catch (e) { /* ignore */ }
                }
                else if (data.type === "approval_required") {
                    setStatus("awaiting_approval");
                    setPendingApproval({ code: data.content });
                }
                else if (data.type === "error") {
                    console.error("Agent Error:", data.content);
                }
                else if (data.type === "done") {
                    setStatus("connected");
                    setThinkingSteps([]);
                    setAgentOutputs([]);
                    setExecutionPlan(null);
                    setPendingApproval(null);
                    if (tokenRef.current) {
                        fetchSessions(tokenRef.current);
                    }
                }
            } catch (e) {
                console.error("SSE Parse Error", e);
            }
        };

        es.onerror = () => {
            if (es.readyState === EventSource.CLOSED) {
                console.log("SSE Closed");
                setStatus("idle");
            }
        };

        eventSourceRef.current = es;
    }, [fetchSessions]);

    const sendMessage = useCallback(async (text: string) => {
        if (!currentSessionId || !tokenRef.current) {
            console.error("Not connected");
            return;
        }

        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: text }]);
        setThinkingSteps([]);
        setAgentOutputs([]);
        setPendingApproval(null);
        setExecutionPlan(null);
        responseBuffer.current = "";

        try {
            const res = await fetch("/api/v1/chat/send", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${tokenRef.current}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ session_id: currentSessionId, content: text }),
            });
            if (!res.ok) {
                console.error("Failed to send message:", res.status);
            }
        } catch (e) {
            console.error("Failed to send message", e);
        }
    }, [currentSessionId]);

    const runBlueprint = useCallback(async (blueprintId: string, input: string) => {
        if (!currentSessionId || !tokenRef.current) {
            console.error("Not connected");
            return;
        }

        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: input }]);
        setThinkingSteps([]);
        setAgentOutputs([]);
        setPendingApproval(null);
        responseBuffer.current = "";

        try {
            const res = await fetch("/api/v1/chat/blueprint", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${tokenRef.current}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    blueprint_id: blueprintId,
                    content: input,
                }),
            });
            if (!res.ok) {
                console.error("Failed to run blueprint:", res.status);
            }
        } catch (e) {
            console.error("Failed to run blueprint", e);
        }
    }, [currentSessionId]);

    const approveAction = useCallback(async (approved: boolean, reason?: string, modifiedCode?: string) => {
        if (!currentSessionId || !tokenRef.current) {
            console.error("Not connected");
            return;
        }

        setPendingApproval(null);
        setStatus("thinking");

        try {
            await fetch("/api/v1/chat/approve", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${tokenRef.current}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    approved,
                    reason: reason || "",
                    modified_code: modifiedCode || "",
                }),
            });
        } catch (e) {
            console.error("Failed to send approval", e);
        }
    }, [currentSessionId]);

    const cancelWorkflow = useCallback(async () => {
        if (currentSessionId && tokenRef.current) {
            try {
                await fetch("/api/v1/chat/cancel", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${tokenRef.current}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ session_id: currentSessionId }),
                });
            } catch (e) {
                console.error("Failed to cancel workflow", e);
            }
        }

        setStatus("connected");
        setThinkingSteps([]);
        setPendingApproval(null);
        responseBuffer.current = "";

        let restoredContent = "";
        const newHistory = [...messages];

        if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === "assistant") {
            newHistory.pop();
        }
        if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === "user") {
            restoredContent = newHistory[newHistory.length - 1].content;
            newHistory.pop();
        }

        setMessages(newHistory);
        return restoredContent;
    }, [currentSessionId, messages]);

    return {
        messages,
        status,
        thinkingSteps,
        agentOutputs,
        pendingApproval,
        executionPlan,
        sessions,
        currentSessionId,
        fetchSessions,
        loadSession,
        startNewSession,
        sendMessage,
        runBlueprint,
        approveAction,
        cancelWorkflow
    };
}
