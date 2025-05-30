# WordPlay LLM Pipeline Flow

## 🔄 All LLM API Call Pipelines

```mermaid
graph TD
    %% User Interactions
    A[User Interface] --> B{Action Type}
    
    %% Branch to different pipeline types
    B -->|AI Agent Request| C[AI Agent Pipeline]
    B -->|Direct AI Features| D[Direct LLM Pipeline]
    B -->|Slash Commands| E[Slash Command Pipeline]
    B -->|Style Analysis| F[Style Analysis Pipeline]
    
    %% AI AGENT PIPELINE (Main Autonomous Pipeline)
    C --> C1["/api/agent/intelligent-request"]
    C1 --> C2["WordPlayAgent.processRequest"]
    C2 --> C3{Provider Selection}
    C3 -->|OpenAI| C4["processOpenAIRequest"]
    C3 -->|Ollama| C5["processOllamaRequest"]
    
    %% OpenAI Agent Processing
    C4 --> C4a["OpenAI Structured Output<br/>JSON Schema Response"]
    C4a --> C4b[Parse Tool Calls]
    C4b --> C6[Tool Execution Loop]
    
    %% Ollama Agent Processing
    C5 --> C5a["Ollama Tool Calling API<br/>/api/chat"]
    C5a --> C5b[Parse Tool Calls]
    C5b --> C6
    C5 -->|Fallback on Error| C4
    
    %% Tool Execution
    C6 --> C7[Execute 1-20 Tools]
    C7 --> C8[Self-Reflection & Learning]
    C8 --> C9[Process All Tool Results]
    C9 --> C10[Synthesized Response]
    
    %% DIRECT LLM PIPELINE (Simple AI Features)
    D --> D1{Feature Type}
    D1 -->|Text Generation| D2["/api/ai/generate"]
    D1 -->|Writing Suggestions| D3["/api/ai/suggestions"]
    D1 -->|Text Commands| D4["/api/ai/process-command"]
    D1 -->|Contextual Help| D5["/api/ai/contextual-help"]
    
    D2 --> D6[openai.ts functions]
    D3 --> D6
    D4 --> D6
    D5 --> D6
    
    D6 --> D7{Provider Selection}
    D7 -->|OpenAI| D8[OpenAI API Direct Call]
    D7 -->|Ollama| D9["callOllama Function"]
    
    %% SLASH COMMAND PIPELINE
    E --> E1["/api/ai/slash-command"]
    E1 --> E2["executeSlashCommand"]
    E2 --> E3{Provider Selection}
    E3 -->|OpenAI| E4[OpenAI Chat Completion]
    E3 -->|Ollama| E5["callOllama with Combined Prompts"]
    
    %% STYLE ANALYSIS PIPELINE (OpenAI Only)
    F --> F1["/api/ai/analyze-style"]
    F1 --> F2["analyzeTextStyle"]
    F2 --> F3[OpenAI JSON Object Response]
    F3 --> F4[Style Metrics Processing]
    
    %% MODEL VALIDATION LAYER
    C4 --> MV[Model Validation Layer]
    C5 --> MV
    D8 --> MV
    D9 --> MV
    E4 --> MV
    E5 --> MV
    F3 --> MV
    
    MV --> MV1{Provider Check}
    MV1 -->|OpenAI| MV2["VALID_OPENAI_MODELS<br/>6 Models Only"]
    MV1 -->|Ollama| MV3["Dynamic Model List<br/>From Ollama Installation"]
    
    %% Final Outputs
    C10 --> OUT1[Agent Response with Tool Results]
    D8 --> OUT2[Direct LLM Response]
    D9 --> OUT2
    E4 --> OUT3[Processed Text/Command Result]
    E5 --> OUT3
    F4 --> OUT4[Style Analysis Metrics]
    
    %% Settings Integration
    SET[Settings Provider] --> MV
    SET --> C3
    SET --> D7
    SET --> E3
    
    %% Styling
    classDef agentPipeline fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef directPipeline fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef slashPipeline fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef stylePipeline fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef modelValidation fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef settings fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    
    class C,C1,C2,C3,C4,C4a,C4b,C5,C5a,C5b,C6,C7,C8,C9,C10 agentPipeline
    class D,D1,D2,D3,D4,D5,D6,D7,D8,D9 directPipeline
    class E,E1,E2,E3,E4,E5 slashPipeline
    class F,F1,F2,F3,F4 stylePipeline
    class MV,MV1,MV2,MV3 modelValidation
    class SET settings
```

## 📊 Pipeline Summary

### 1. **AI Agent Pipeline** (Most Complex)
- **Endpoint**: `/api/agent/intelligent-request`
- **Features**: Tool calling, autonomous execution, self-reflection
- **Providers**: OpenAI + Ollama (with fallback)
- **Models**: Your 6 OpenAI models OR user's installed Ollama models
- **Capability**: Can execute 1-20 tools in sequence, learns from results

### 2. **Direct LLM Pipeline** (Simple AI Features)
- **Endpoints**: `/api/ai/generate`, `/api/ai/suggestions`, `/api/ai/process-command`, `/api/ai/contextual-help`
- **Features**: Single-shot LLM calls for specific tasks
- **Providers**: OpenAI + Ollama
- **Use Cases**: Text generation, writing suggestions, basic commands

### 3. **Slash Command Pipeline** (Editor Integration)
- **Endpoint**: `/api/ai/slash-command`
- **Features**: In-editor text processing commands (/improve, /summarize, etc.)
- **Providers**: OpenAI + Ollama
- **Use Cases**: Quick text edits and improvements

### 4. **Style Analysis Pipeline** (OpenAI Only)
- **Endpoint**: `/api/ai/analyze-style`
- **Features**: Deep text analysis with structured metrics
- **Providers**: OpenAI only (requires JSON object response)
- **Use Cases**: Writing quality assessment, style metrics

## 🎯 Key Differences:
- **Agent Pipeline**: Autonomous, multi-step, tool-using
- **Direct Pipeline**: Simple, single-response LLM calls  
- **Slash Pipeline**: Editor-integrated text processing
- **Style Pipeline**: Analytical, metrics-focused

All pipelines respect your model restrictions (6 OpenAI models + dynamic Ollama models). 