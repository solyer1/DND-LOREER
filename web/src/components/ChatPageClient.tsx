"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

export default function ChatPageClient() {
  const [activeTab, setActiveTab] = useState<"chat" | "settings">("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Multi-session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Settings
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [contextLimit, setContextLimit] = useState("50");
  const [persona, setPersona] = useState("lore_assistant");
  
  // Model Fetching
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Load settings
    const savedEndpoint = localStorage.getItem("ai_endpoint");
    const savedKey = localStorage.getItem("ai_apiKey");
    const savedModel = localStorage.getItem("ai_model");
    const savedLimit = localStorage.getItem("ai_contextLimit");
    const savedPersona = localStorage.getItem("ai_persona");

    if (savedEndpoint) setEndpoint(savedEndpoint);
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModel(savedModel);
    if (savedLimit) setContextLimit(savedLimit);
    if (savedPersona) setPersona(savedPersona);

    // Load Sessions
    const savedSessions = localStorage.getItem("ai_chat_sessions");
    const legacyHistory = localStorage.getItem("ai_chat_history");

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to parse chat sessions");
        createNewSession();
      }
    } else if (legacyHistory) {
      // Migrate legacy history
      try {
        const parsed = JSON.parse(legacyHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const newSession: ChatSession = {
            id: Date.now().toString(),
            title: "Legacy Chat",
            updatedAt: Date.now(),
            messages: parsed
          };
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
          localStorage.removeItem("ai_chat_history");
        } else {
          createNewSession();
        }
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions whenever they change (only after mount)
  useEffect(() => {
    if (isMounted && sessions.length > 0) {
      localStorage.setItem("ai_chat_sessions", JSON.stringify(sessions));
    } else if (isMounted && sessions.length === 0) {
      localStorage.removeItem("ai_chat_sessions");
    }
  }, [sessions, isMounted]);

  const saveSettings = (k: string, v: string) => {
    localStorage.setItem(k, v);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const createNewSession = () => {
    const defaultMessage: Message = { role: "assistant", content: "Hello! I am the Keeper of Lore. Ask me anything about the realm." };
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat",
      updatedAt: Date.now(),
      messages: [defaultMessage]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this chat?")) {
      const nextSessions = sessions.filter(s => s.id !== id);
      setSessions(nextSessions);
      if (activeSessionId === id) {
        setActiveSessionId(nextSessions.length > 0 ? nextSessions[0].id : null);
      }
      if (nextSessions.length === 0) {
        createNewSession();
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessageContent = input.trim();
    const userMessage: Message = { role: "user", content: userMessageContent };
    
    let currentSessionId = activeSessionId;

    let targetSession = sessions.find(s => s.id === currentSessionId);

    // If somehow no active session, create one
    if (!targetSession) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: "New Chat",
        updatedAt: Date.now(),
        messages: [{ role: "assistant", content: "Hello! I am the Keeper of Lore. Ask me anything about the realm." }]
      };
      currentSessionId = newSession.id;
      targetSession = newSession;
      setActiveSessionId(currentSessionId);
    }

    // Auto-title if it's the first real user message
    let newTitle = targetSession.title;
    if (targetSession.messages.length <= 1 && targetSession.title === "New Chat") {
      newTitle = userMessageContent.slice(0, 30) + (userMessageContent.length > 30 ? "..." : "");
    }
    
    const messagesForApi = [...targetSession.messages, userMessage];
    
    setSessions(prev => {
      let exists = false;
      const next = prev.map(session => {
        if (session.id === currentSessionId) {
          exists = true;
          return {
            ...session,
            title: newTitle,
            messages: messagesForApi,
            updatedAt: Date.now()
          };
        }
        return session;
      });
      
      if (!exists && targetSession) {
        next.push({
          ...targetSession,
          title: newTitle,
          messages: messagesForApi,
          updatedAt: Date.now()
        });
      }
      
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });

    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          settings: {
            endpoint,
            apiKey,
            model,
            contextLimit: parseInt(contextLimit) || 50,
            persona,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(prev => prev.map(session => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: [...session.messages, { role: "assistant" as const, content: data.message }],
              updatedAt: Date.now()
            };
          }
          return session;
        }).sort((a, b) => b.updatedAt - a.updatedAt));
      } else {
        const errorData = await response.json();
        setSessions(prev => prev.map(session => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: [...session.messages, { role: "assistant" as const, content: `*Error:* ${errorData.error || "Failed to get response"}` }],
              updatedAt: Date.now()
            };
          }
          return session;
        }));
      }
    } catch (e: any) {
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, { role: "assistant" as const, content: `*Network Error:* ${e.message}` }],
            updatedAt: Date.now()
          };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllHistory = () => {
    if (confirm("Are you sure you want to completely clear ALL chat sessions?")) {
      setSessions([]);
      setActiveSessionId(null);
      localStorage.removeItem("ai_chat_sessions");
      createNewSession();
    }
  };

  const checkApiModels = async () => {
    if (!endpoint) {
      setApiError("Please enter an API Endpoint first.");
      return;
    }
    
    setIsCheckingApi(true);
    setApiError(null);
    setAvailableModels([]);

    try {
      // Typically the models endpoint is baseURL/models
      let baseUrl = endpoint;
      if (baseUrl.endsWith("/chat/completions")) {
        baseUrl = baseUrl.substring(0, baseUrl.length - "/chat/completions".length);
      } else if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.substring(0, baseUrl.length - 1);
      }
      
      const modelsUrl = `${baseUrl}/models`;
      
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(modelsUrl, { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && data.data && Array.isArray(data.data)) {
        const modelIds = Array.from(new Set(data.data.map((m: any) => m.id).filter(Boolean))) as string[];
        setAvailableModels(modelIds);
        if (modelIds.length > 0 && !modelIds.includes(model)) {
          setModel(modelIds[0]);
          saveSettings("ai_model", modelIds[0]);
        }
      } else {
        throw new Error("Invalid response format: missing data array.");
      }
    } catch (e: any) {
      setApiError(`Failed to fetch models: ${e.message}`);
    } finally {
      setIsCheckingApi(false);
    }
  };

  if (!isMounted) return null; // Avoid hydration mismatch

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] w-full mx-auto p-2 sm:p-4 lg:p-6" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b shrink-0 max-w-7xl mx-auto w-full" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
              Ask the Keeper
            </h1>
            <p className="hidden sm:block text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              Consult the AI assistant about the lore and mechanics of King's Sanctuary.
            </p>
          </div>
        </div>
        
        <div className="flex bg-opacity-20 rounded-xl p-1 shrink-0" style={{ background: "var(--bg-elevated)" }}>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "chat" ? "shadow-sm" : ""}`}
            style={{ 
              background: activeTab === "chat" ? "var(--accent-600)" : "transparent",
              color: activeTab === "chat" ? "white" : "var(--text-secondary)"
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "settings" ? "shadow-sm" : ""}`}
            style={{ 
              background: activeTab === "settings" ? "var(--accent-600)" : "transparent",
              color: activeTab === "settings" ? "white" : "var(--text-secondary)"
            }}
          >
            Settings
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 max-w-7xl mx-auto w-full relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && activeTab === "chat" && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "var(--bg-overlay)" }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ═══ History Sidebar ═══ */}
        {activeTab === "chat" && (
          <div
            className={`
              absolute lg:relative z-50 lg:z-auto h-full flex flex-col w-[260px] shrink-0 rounded-2xl border shadow-sm transition-transform duration-300 ease-out
              ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}
          >
            <div className="p-3">
              <button
                onClick={createNewSession}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
                style={{ background: "var(--accent-600)", color: "white" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest my-2" style={{ color: "var(--text-tertiary)" }}>
                Recent Chats
              </p>
              
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className="group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer"
                  style={{
                    background: activeSessionId === session.id ? "var(--bg-elevated)" : "transparent",
                    color: activeSessionId === session.id ? "var(--text-primary)" : "var(--text-secondary)",
                    border: activeSessionId === session.id ? "1px solid var(--border-subtle)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (activeSessionId !== session.id) e.currentTarget.style.background = "var(--bg-tertiary)";
                  }}
                  onMouseLeave={(e) => {
                    if (activeSessionId !== session.id) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className="truncate flex-1 font-medium">{session.title}</span>
                  
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                    title="Delete Chat"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Main Chat / Settings Area ═══ */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden border shadow-sm h-full" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}>
          {activeTab === "chat" ? (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {!activeSession && (
                  <div className="flex h-full items-center justify-center">
                    <p style={{ color: "var(--text-tertiary)" }}>Create a new chat to begin.</p>
                  </div>
                )}
                {activeSession && messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] md:max-w-[85%] rounded-2xl p-4 text-[15px] leading-relaxed prose prose-sm md:prose-base prose-invert prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 break-words`}
                      style={{
                        background: msg.role === "user" ? "var(--accent-600)" : "var(--bg-elevated)",
                        color: msg.role === "user" ? "white" : "var(--text-secondary)",
                        border: msg.role === "assistant" ? "1px solid var(--border-subtle)" : "none",
                        borderBottomRightRadius: msg.role === "user" ? "4px" : "16px",
                        borderBottomLeftRadius: msg.role === "assistant" ? "4px" : "16px",
                      }}
                    >
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-2xl rounded-bl-sm p-4"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div className="flex gap-1.5 items-center h-4">
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 md:p-4 border-t" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                <div className="max-w-4xl mx-auto mb-2">
                  <select 
                    value={persona} 
                    onChange={(e) => {
                      setPersona(e.target.value);
                      saveSettings("ai_persona", e.target.value);
                    }}
                    className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer rounded px-2 py-1 transition-colors"
                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="lore_assistant">Role: Lore Assistant</option>
                    <option value="character_builder">Role: Character Kits Builder</option>
                    <option value="lore_maker">Role: Lore Maker</option>
                  </select>
                </div>
                <div className="relative flex max-w-4xl mx-auto">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask about the lore..."
                    className="w-full bg-transparent resize-none rounded-xl py-3 pl-4 pr-12 text-[15px] focus:outline-none shadow-sm transition-colors"
                    rows={1}
                    style={{
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-primary)",
                      minHeight: "48px",
                      maxHeight: "200px"
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 bottom-2 p-1.5 rounded-lg transition-colors disabled:opacity-50 hover:bg-opacity-10 hover:bg-white"
                    style={{ color: "var(--accent-500)" }}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Settings Area */
            <div className="flex-1 overflow-y-auto p-6 md:p-8 w-full max-w-2xl mx-auto">
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Custom AI Endpoint</h2>
              <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>
                Configure your own AI endpoint to override the server's defaults. These settings are saved in your browser.
              </p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>API Endpoint</label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => {
                      setEndpoint(e.target.value);
                      saveSettings("ai_endpoint", e.target.value);
                    }}
                    placeholder="e.g., https://alpha-claims-film-beauty.trycloudflare.com/v1/chat/completions"
                    className="w-full px-4 py-3 text-sm rounded-xl border focus:outline-none shadow-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    Must include the full path (e.g. <code>/v1/chat/completions</code>). If using a Cloudflare tunnel, make sure to copy it correctly.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>API Key (if required)</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      saveSettings("ai_apiKey", e.target.value);
                    }}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 text-sm rounded-xl border focus:outline-none shadow-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                  <div className="pt-2">
                    <button
                      onClick={checkApiModels}
                      disabled={isCheckingApi}
                      className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors shadow-sm disabled:opacity-50"
                      style={{ 
                        background: "var(--bg-elevated)", 
                        color: "var(--text-primary)", 
                        borderColor: "var(--border-default)" 
                      }}
                    >
                      {isCheckingApi ? "Checking..." : "Check API Models"}
                    </button>
                    {apiError && <p className="text-xs text-red-500 mt-2">{apiError}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>Model Name</label>
                  {availableModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        saveSettings("ai_model", e.target.value);
                      }}
                      className="w-full px-4 py-3 text-sm rounded-xl border focus:outline-none shadow-sm cursor-pointer"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    >
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        saveSettings("ai_model", e.target.value);
                      }}
                      placeholder="e.g., llama3 (Or click 'Check API Models' to fetch)"
                      className="w-full px-4 py-3 text-sm rounded-xl border focus:outline-none shadow-sm"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    />
                  )}
                </div>

                <div className="space-y-2 pt-4">
                  <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>Context Limit (Lore Entries)</label>
                  <input
                    type="number"
                    value={contextLimit}
                    onChange={(e) => {
                      setContextLimit(e.target.value);
                      saveSettings("ai_contextLimit", e.target.value);
                    }}
                    min="0"
                    max="1000"
                    className="w-full px-4 py-3 text-sm rounded-xl border focus:outline-none shadow-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                    Number of recent lore entries injected as context into the system prompt. Too many might cause token limit errors on local LLMs. Use 0 to disable context injection entirely.
                  </p>
                </div>

                <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-between items-center border-t mt-8" style={{ borderColor: "var(--border-subtle)" }}>
                  <button
                    onClick={clearAllHistory}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors border w-full sm:w-auto"
                    style={{ color: "var(--error-500)", borderColor: "var(--error-500)", background: "transparent" }}
                  >
                    Clear All Chat History
                  </button>
                  <button
                    onClick={() => setActiveTab("chat")}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm w-full sm:w-auto text-center"
                    style={{ background: "var(--accent-600)", color: "white" }}
                  >
                    Save & Go Back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: var(--text-tertiary); }
      `}} />
    </div>
  );
}
