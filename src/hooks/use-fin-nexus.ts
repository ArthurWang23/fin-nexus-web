import { useState, useRef, useEffect, useCallback } from 'react';

// 消息类型定义
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

export function useFinNexus() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [status, setStatus] = useState<"idle" | "connected" | "thinking" | "streaming">("idle");
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const responseBuffer = useRef("");

    // 获取会话列表
    const fetchSessions = useCallback(async (token: string) => {
        try {
            const res = await fetch("/api/v1/sessions", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // 假设后端返回的是 null 或 空数组
                setSessions(data || []);
            }
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        }
    }, []);

    // 加载某个会话的历史记录
    const loadSession = useCallback(async (token: string, sessionId: string) => {
        // 1. 关闭旧连接
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setCurrentSessionId(sessionId);
        setMessages([]); // 清空当前显示
        setThinkingSteps([]); // Clear thinking steps
        setStatus("idle");

        // 2. 获取历史记录
        try {
            const res = await fetch(`/api/v1/sessions/${sessionId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const history: Message[] = await res.json();
                // 确保 role 是正确的
                setMessages(history.map(m => ({
                    ...m,
                    role: m.role as "user" | "assistant" | "system"
                })));
            }
        } catch (e) {
            console.error("Failed to load session history", e);
        }

        // 3. 建立新连接
        connect(token, sessionId);
    }, []);

    // 创建新会话 (纯前端生成 ID，有了第一条消息后再刷新列表?)
    // 或者直接连接，后端会在有消息时创建 Session
    const startNewSession = useCallback((token: string) => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        const newId = crypto.randomUUID();
        setCurrentSessionId(newId);
        setMessages([]);
        setThinkingSteps([]);
        setStatus("idle");
        connect(token, newId);
        return newId;
    }, []);

    // 连接 WebSocket
    const connect = useCallback((token: string, sessionId: string) => {
        // 使用 window.location.host 自动适配
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host; // localhost:3000 -> 代理到 localhost:8080
        // 由于配置了 next.config.ts rewrite，我们可以直接连 /api/v1/ws/chat (需要确认 rewrite 是否支持 ws)
        // 遗憾的是 Next.js rewrites 对 WebSocket 支持通常有限或需要配置。
        // 为了稳妥，可以直接连后端端口 8080，或者假设 rewrite 支持。
        // 但用户提到 404，说明 rewrite 之前没配好。现在配好了 HTTP，WS 不一定。
        // 我们直接连 http://localhost:8080/api/v1/ws/chat 对应的 ws 地址 ws://localhost:8080/...
        // 这里硬编码一下，或者用环境变量。既然是 demo，先写死后端地址。

        const wsUrl = `ws://localhost:8080/api/v1/ws/chat?token=${token}&session_id=${sessionId}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("WS Connected", sessionId);
            setStatus("connected");
        };

        ws.onmessage = (event) => {
            try {
                // 后端发来的是纯文本或 JSON string
                // 我们的后端 writePump 是：ws.WriteMessage(websocket.TextMessage, []byte(msg.Payload))
                // Payload 是 JSON 字符串 {type: "...", content: "..."}

                const data = JSON.parse(event.data);

                // 1. 处理步骤消息 (Step)
                if (data.type === "step") {
                    setStatus("thinking");
                    setThinkingSteps((prev) => [...prev, data.content]);
                }
                // 2. 处理流式文字 (Token)
                else if (data.type === "token") {
                    setStatus("streaming");
                    responseBuffer.current += data.content;

                    setMessages((prev) => {
                        const lastMsg = prev[prev.length - 1];
                        if (!lastMsg || lastMsg.role === "user") {
                            // 新增一条 assistant 消息
                            return [...prev, { id: Date.now().toString(), role: "assistant", content: responseBuffer.current }];
                        }
                        // 更新最后一条
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1].content = responseBuffer.current;
                        return newHistory;
                    });
                }
                // 3. 错误
                else if (data.type === "error") {
                    console.error("Agent Error:", data.content);
                }
                // 4. 完成 (Done) - 也许后端会发，或者就只是停止发 token
                else if (data.type === "done") {
                    setStatus("connected");
                    // 可以在这里刷新 session 列表 (如果是新会话)
                    fetchSessions(token);
                }

            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = () => {
            console.log("WS Closed");
            if (status !== "idle") setStatus("idle");
        }

        wsRef.current = ws;
    }, [fetchSessions]); // fetchSessions 依赖

    // 发送消息
    const sendMessage = useCallback((text: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.error("WS not connected");
            return;
        }

        // 1. UI 显示 User Message
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: text }]);
        setThinkingSteps([]); // Clear thinking steps on new message

        // 2. 清空 Buffer
        responseBuffer.current = "";

        // 3. 发送
        wsRef.current.send(text);
    }, []);

    return {
        messages,
        status,
        thinkingSteps,
        sessions,
        currentSessionId,
        fetchSessions,
        loadSession,
        startNewSession,
        sendMessage
    };
}