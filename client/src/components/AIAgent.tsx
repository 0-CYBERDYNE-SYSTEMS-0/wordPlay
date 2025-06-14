import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApiProcessing } from "@/hooks/use-api-processing";
import { Bot, Send, Wrench, Loader2, User, Copy, CheckCircle, AlertCircle, ChevronRight, ChevronDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AIAgentProps {
  currentProject?: any;
  currentDocument?: any;
  llmProvider?: 'openai' | 'ollama';
  llmModel?: string;
  onToolResult?: (result: any) => void;
  editorState?: {
    title: string;
    content: string;
    hasUnsavedChanges: boolean;
    wordCount: number;
  };
}

interface Message {
  id: string;
  type: "user" | "agent" | "tool";
  content: string;
  timestamp: Date;
  toolName?: string;
  toolResult?: any;
}

interface ToolCall {
  tool: string;
  params: any;
  reasoning: string;
}

// Helper function to identify editor-related tools
function isEditorTool(toolName: string): boolean {
  const editorTools = [
    'edit_current_document',
    'replace_current_content', 
    'edit_text_with_pattern',
    'improve_current_text',
    'update_document',
    'replace_in_text',
    'generate_text',
    'process_text_command',
    'create_document'
  ];
  return editorTools.includes(toolName);
}

export default function AIAgent({ 
  currentProject, 
  currentDocument, 
  llmProvider,
  llmModel,
  onToolResult,
  editorState
}: AIAgentProps) {
  const { toast } = useToast();
  const { startProcessing, stopProcessing } = useApiProcessing();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize position to center of screen when first opened
  useEffect(() => {
    if (!isMinimized && position.x === 0 && position.y === 0) {
      setPosition({
        x: window.innerWidth / 2 - 200, // 200 = half of modal width (400px)
        y: window.innerHeight / 2 - 200 // 200 = half of modal height (400px)
      });
    }
  }, [isMinimized, position]);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep modal within screen bounds
      const maxX = window.innerWidth - 400; // 400 = modal width
      const maxY = window.innerHeight - 400; // 400 = modal height
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Agent context based on current app state
  const agentContext = {
    currentProject,
    currentDocument,
    llmProvider,
    llmModel,
    userId: 1,
    editorState
  };

  // Get available tools
  const { data: toolsData } = useQuery({
    queryKey: ["agent-tools"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/agent/tools");
      return res.json();
    }
  });

  // Send request to agent
  const agentMutation = useMutation({
    mutationFn: async (request: string) => {
      startProcessing("Agent is analyzing your request...");
      try {
        const res = await apiRequest("POST", "/api/agent/intelligent-request", {
          request,
          context: agentContext
        });
        return res.json();
      } finally {
        stopProcessing();
      }
    },
    onSuccess: (data) => {
      // Add agent response with intelligent synthesis
      const agentMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: data.response || "I've processed your request.",
        timestamp: new Date(),
        toolResult: {
          plan: data.plan,
          toolsExecuted: data.toolsExecuted,
          suggestedActions: data.suggestedActions,
          executionDetails: data.executionDetails
        }
      };
      setMessages(prev => [...prev, agentMessage]);

      // ENHANCED: Process tool results for editor integration
      if (data.toolsExecuted && data.toolsExecuted.length > 0 && onToolResult) {
        data.toolsExecuted.forEach((tool: any) => {
          // Only trigger onToolResult for successful editor-related tools
          if (tool.success && isEditorTool(tool.tool)) {
            console.log(`🔧 Triggering editor update for tool: ${tool.tool}`);
            onToolResult({
              success: tool.success,
              data: tool.data,
              error: tool.error,
              message: tool.message,
              tool: tool.tool,
              executionTime: 0
            });
          }
        });
      }

      // Show suggested actions if any
      if (data.suggestedActions && data.suggestedActions.length > 0) {
        const actionsMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "tool",
          content: "💡 **Suggested Next Steps:**\n" + data.suggestedActions.map((action: string, index: number) => `${index + 1}. ${action}`).join('\n'),
          timestamp: new Date(),
          toolName: "suggestions"
        };
        setMessages(prev => [...prev, actionsMessage]);
      }

      // Execute additional tool calls if suggested
      if (data.additionalToolCalls && data.additionalToolCalls.length > 0) {
        data.additionalToolCalls.forEach((toolCall: any) => {
          executeToolCall(toolCall);
        });
      }

      // Show execution summary if tools were used
      if (data.executionDetails && data.executionDetails.toolsExecuted > 0) {
        toast({
          title: "Agent Task Complete",
          description: `Executed ${data.executionDetails.toolsExecuted} tools successfully. ${data.executionDetails.failedTools > 0 ? `(${data.executionDetails.failedTools} failed)` : ''}`,
        });
      }
    },
    onError: (error: any) => {
      // Handle intelligent error responses
      const errorResponse = error.response?.data;
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: errorResponse?.fallbackResponse || "I encountered an issue processing your request. Let me try a different approach.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: "Agent Error",
        description: errorResponse?.message || error.message,
        variant: "destructive"
      });
    }
  });

  // Execute individual tool
  const toolMutation = useMutation({
    mutationFn: async ({ toolName, parameters }: { toolName: string; parameters: any }) => {
      startProcessing(`Executing ${toolName}...`);
      try {
        const res = await apiRequest("POST", "/api/agent/tool", {
          toolName,
          parameters,
          context: agentContext
        });
        return res.json();
      } finally {
        stopProcessing();
      }
    },
    onSuccess: (data, variables) => {
      const toolMessage: Message = {
        id: Date.now().toString(),
        type: "tool",
        content: data.message || "Tool executed successfully",
        timestamp: new Date(),
        toolName: variables.toolName,
        toolResult: data.data
      };
      setMessages(prev => [...prev, toolMessage]);

      // Notify parent component of tool result
      if (onToolResult) {
        onToolResult(data);
      }

      if (data.success) {
        toast({
          title: "Tool Executed",
          description: data.message,
        });
      } else {
        toast({
          title: "Tool Error",
          description: data.error,
          variant: "destructive"
        });
      }
    }
  });

  const executeToolCall = (toolCall: ToolCall) => {
    toolMutation.mutate({
      toolName: toolCall.tool,
      parameters: toolCall.params
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to agent
    agentMutation.mutate(input);
    setInput("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard"
    });
  };

  return (
    <>
      {/* Floating AI Button - Bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
          title="wordPlay agent"
        >
          <Bot className="w-6 h-6" />
          {messages.length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">{messages.length}</span>
            </div>
          )}
        </button>
      </div>

      {/* AI Agent Modal - Only when expanded */}
      {!isMinimized && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div 
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-96 h-96 flex flex-col"
            style={{
              position: 'absolute',
              left: position.x,
              top: position.y,
              transform: 'none'
            }}
          >
            {/* Draggable Header */}
            <div 
              className={`flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 rounded-t-lg ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              } select-none bg-gray-50 dark:bg-gray-800`}
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-blue-500" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">AI Writing Assistant</span>
                <div className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {isDragging ? 'Dragging...' : 'Drag to move'}
                </div>
              </div>
              <button
                onClick={() => setIsMinimized(true)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">Hi! I'm your AI writing assistant.</p>
                    <p className="text-sm mt-1 opacity-75">
                      Ask me anything about writing, editing, or research.
                    </p>
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {message.type === "user" && (
                        <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                          <User className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {message.type === "agent" && (
                        <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {message.type === "tool" && (
                        <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center">
                          <Wrench className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        {message.type === "tool" && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 mb-1 font-medium">
                            {message.toolName}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(message.content)}
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {agentMutation.isPending && (
                  <div className="flex items-center space-x-3">
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="px-4 pb-4 border-t dark:border-gray-700 pt-4">
              <form onSubmit={handleSubmit} className="flex space-x-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about writing..."
                  className="flex-1"
                  disabled={agentMutation.isPending}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || agentMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Improve my writing")}
                  className="text-xs"
                >
                  Improve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Fix grammar")}
                  className="text-xs"
                >
                  Fix
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Research help")}
                  className="text-xs"
                >
                  Research
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 