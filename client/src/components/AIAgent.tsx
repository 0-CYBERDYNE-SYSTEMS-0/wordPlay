import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, Wrench, Loader2, User, Copy, CheckCircle, AlertCircle } from "lucide-react";
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

export default function AIAgent({ 
  currentProject, 
  currentDocument, 
  llmProvider,
  llmModel,
  onToolResult 
}: AIAgentProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Agent context based on current app state
  const agentContext = {
    currentProject,
    currentDocument,
    llmProvider,
    llmModel,
    userId: 1
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
      const res = await apiRequest("POST", "/api/agent/request", {
        request,
        context: agentContext
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Add agent response
      const agentMessage: Message = {
        id: Date.now().toString(),
        type: "agent",
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentMessage]);

      // If there are tool calls, show them
      if (data.toolCalls && data.toolCalls.length > 0) {
        data.toolCalls.forEach((toolCall: ToolCall) => {
          executeToolCall(toolCall);
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Agent Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Execute individual tool
  const toolMutation = useMutation({
    mutationFn: async ({ toolName, parameters }: { toolName: string; parameters: any }) => {
      const res = await apiRequest("POST", "/api/agent/tool", {
        toolName,
        parameters,
        context: agentContext
      });
      return res.json();
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

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full h-12 w-12 bg-primary hover:bg-primary-dark"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] z-50 flex flex-col shadow-lg">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-sm">
            <Bot className="h-4 w-4 mr-2" />
            AI Writing Agent
          </CardTitle>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500">
              {toolsData?.tools?.length || 0} tools
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </div>
        {agentContext.currentProject && (
          <p className="text-xs text-gray-500">
            Project: {agentContext.currentProject.name}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-3 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0 max-h-[400px]">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Hi! I'm your AI writing agent.</p>
              <p className="text-xs mt-1">
                I can help with research, writing, editing, and project management.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-2">
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
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  {message.type === "tool" && (
                    <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">
                      Tool: {message.toolName}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {message.toolResult && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(message.toolResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(message.content)}
                    className="h-4 w-4 p-0 opacity-50 hover:opacity-100"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {agentMutation.isPending && (
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <Bot className="h-3 w-3 text-white" />
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your writing..."
              className="flex-1 text-sm"
              disabled={agentMutation.isPending}
            />
            <Button
              type="submit"
              disabled={!input.trim() || agentMutation.isPending}
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("Help me research this topic")}
              className="text-xs"
            >
              Research
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("Analyze my writing style")}
              className="text-xs"
            >
              Style Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput("Generate an outline")}
              className="text-xs"
            >
              Outline
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 