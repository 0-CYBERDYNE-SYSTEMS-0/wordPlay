import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import UltraMinimalEditor from "@/components/UltraMinimalEditor";
import ContextPanel from "@/components/ContextPanel";
import SmartPanelManager from "@/components/SmartPanelManager";
import NewProjectModal from "@/components/NewProjectModal";
import WebSearch from "@/components/WebSearch";
import AIAgent from "@/components/AIAgent";
import SettingsPanel from "@/components/SettingsPanel";
import WelcomeModal from "@/components/WelcomeModal";
import AgentApplyDialog from "@/components/AgentApplyDialog";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

import { useDocument } from "@/hooks/use-document";
import { useSettings } from "@/providers/SettingsProvider";
import type { Project, Document } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface PanelState {
  sidebar: 'hidden' | 'auto-hide' | 'visible' | 'always-visible';
  context: 'hidden' | 'contextual' | 'visible' | 'always-visible';
  header: 'minimal' | 'normal' | 'full';
  footer?: 'hidden' | 'minimal' | 'normal';
}

export default function Home() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // UI State Management - Ultra Minimalist Approach
  const [panelState, setPanelState] = useState<PanelState>({
    sidebar: 'auto-hide',
    context: 'contextual',
    header: 'minimal'
  });
  
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(!settings.hasCompletedOnboarding);
  const [activeTab, setActiveTab] = useState<"editor" | "research" | "settings">("editor");
  // Start with no selection; the project/document lists populate it. This avoids
  // reloading a stale hardcoded ID (e.g. document 1) that may have been deleted.
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  
  // Full screen state management
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [preFullScreenState, setPreFullScreenState] = useState<PanelState>({
    sidebar: 'auto-hide',
    context: 'contextual',
    header: 'minimal'
  });

  // AI Suggestions for context panel
  const [aiSuggestions, setAiSuggestions] = useState<string>("");
  
  // Focus mode hierarchy - AI-driven transitions
  const [focusMode, setFocusMode] = useState<'writing' | 'organizing' | 'researching' | 'settings'>('writing');
  
  // Panel resize state
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [contextPanelWidth, setContextPanelWidth] = useState(384);

  // Writing context for smart panel management
  const [writingContext, setWritingContext] = useState({
    content: '',
    wordCount: 0,
    typingActivity: 'idle' as 'idle' | 'active' | 'intense',
    userMode: 'writing' as 'writing' | 'organizing' | 'researching' | 'settings',
    hasUnsavedChanges: false,
    lastActivity: new Date(),
    aiSuggestionsAvailable: false,
    isFullScreen: false
  });
  const lastContentChangeRef = React.useRef(Date.now());
  const activityIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch projects
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch documents for the active project so we can auto-select the first one
  const { data: projectDocuments } = useQuery<Document[]>({
    queryKey: [`/api/projects/${activeProjectId}/documents`],
    enabled: !!activeProjectId,
  });

  // Auto-select the first project (and its first document) once the lists load.
  // Previously the app hardcoded project/document id 1, which 404s after the
  // seed data is deleted — this recovers gracefully on reload.
  useEffect(() => {
    if (activeProjectId === null && projects && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (activeDocumentId === null && projectDocuments && projectDocuments.length > 0) {
      setActiveDocumentId(projectDocuments[0].id);
    }
  }, [projectDocuments, activeDocumentId]);

  // Current active project
  const activeProject = projects?.find(project => project.id === activeProjectId) || null;

  // Use document hook for the active document
  const {
    title,
    setTitle,
    content,
    setContentTyping,
    applyWithHistory,
    undoContent,
    redoContent,
    isSaving,
    isDirty,
    saveError,
    autoSaveEnabled,
    saveDocument,
    documentData
  } = useDocument({
    documentId: activeDocumentId || undefined,
    projectId: activeProjectId || undefined,
    autosaveInterval: settings.autosaveInterval
  });

  // Pending whole-document agent rewrite awaiting writer approval
  const [pendingAgentApply, setPendingAgentApply] = useState<{
    tool: string;
    reason?: string;
    before: string;
    after: string;
    newTitle?: string;
  } | null>(null);

  // Stable writing-context updates (no lastActivity feedback loop)
  useEffect(() => {
    lastContentChangeRef.current = Date.now();
    const wordCount = content.trim()
      ? content.trim().split(/\s+/).filter((word) => word.length > 0).length
      : 0;

    setWritingContext((prev) => ({
      ...prev,
      content,
      wordCount,
      typingActivity: 'intense',
      userMode: focusMode,
      hasUnsavedChanges: isDirty,
      lastActivity: new Date(lastContentChangeRef.current),
      aiSuggestionsAvailable: aiSuggestions.length > 0,
      isFullScreen,
    }));

    if (activityIdleTimerRef.current) clearTimeout(activityIdleTimerRef.current);
    activityIdleTimerRef.current = setTimeout(() => {
      setWritingContext((prev) => ({
        ...prev,
        typingActivity: 'active',
      }));
      activityIdleTimerRef.current = setTimeout(() => {
        setWritingContext((prev) => ({
          ...prev,
          typingActivity: 'idle',
        }));
      }, 2000);
    }, 1000);

    return () => {
      if (activityIdleTimerRef.current) clearTimeout(activityIdleTimerRef.current);
    };
  }, [content, isDirty, focusMode, aiSuggestions, isFullScreen]);

  // Smart panel state management
  const handlePanelStateChange = useCallback((newState: PanelState) => {
    setPanelState(newState);
  }, []);

  // Handle new project creation
  const handleNewProject = () => {
    setNewProjectModalOpen(true);
  };

  // Handle project selection
  const handleSelectProject = async (projectId: number) => {
    // Flush unsaved edits to the current document before switching, so they aren't dropped
    try {
      await saveDocument();
    } catch {
      // proceeding with the switch even if the flush fails
    }
    setActiveProjectId(projectId);
    setActiveDocumentId(null); // Reset active document when changing projects
    setFocusMode('organizing'); // Switch to organizing mode for project management
  };

  // Handle document selection
  const handleSelectDocument = async (documentId: number) => {
    // Flush unsaved edits to the current document before switching, so they aren't dropped
    try {
      await saveDocument();
    } catch {
      // proceeding with the switch even if the flush fails
    }
    setActiveDocumentId(documentId);
    // Automatically switch to editor and writing focus mode when a document is selected
    setActiveTab("editor");
    setFocusMode("writing");
  };

  // ---------------------------------------------------------------------------
  // Agent → editor integration.
  // Every agent write goes through the undoable apply-path; whole-document
  // rewrites additionally require the writer's approval before anything changes.
  // ---------------------------------------------------------------------------
  const handleAgentToolResult = useCallback((result: any) => {
    if (!result.success) {
      toast({
        title: "Tool Error",
        description: result.error || "Tool execution failed",
        variant: "destructive"
      });
      return;
    }

    const insertUndoable = (text: string, title: string, description: string) => {
      applyWithHistory((prev) => `${prev}\n\n${text}`);
      toast({ title, description: `${description} Undo with ⌘Z.` });
    };

    switch (result.tool) {
      case 'update_document':
        if (result.data?.content !== undefined) {
          setPendingAgentApply({
            tool: result.tool,
            before: content,
            after: result.data.content,
            newTitle: result.data.title || undefined,
            reason: "The agent proposed a new version of this document.",
          });
        }
        break;

      case 'replace_in_text':
        if (result.data?.result !== undefined) {
          setPendingAgentApply({
            tool: result.tool,
            before: content,
            after: result.data.result,
            reason: `Replaces ${result.data.count ?? 0} instance(s).`,
          });
        }
        break;

      case 'generate_text':
        if (result.data && typeof result.data === 'string') {
          insertUndoable(result.data, "Text Generated", "AI generated content was added at the end of the document.");
        }
        break;

      case 'process_text_command':
        if (result.data && typeof result.data === 'string') {
          setPendingAgentApply({
            tool: result.tool,
            before: content,
            after: result.data,
            reason: "Applied a text command to the whole document.",
          });
        }
        break;

      case 'edit_current_document':
        if (result.data?.operation && result.data?.content !== undefined) {
          if (result.data.operation === 'replace') {
            setPendingAgentApply({
              tool: result.tool,
              before: content,
              after: result.data.content,
              reason: "The agent proposed replacing the document.",
            });
          } else if (result.data.operation === 'append') {
            applyWithHistory((prev) => prev + result.data.content);
            toast({ title: "Editor Updated", description: "Content appended. Undo with ⌘Z." });
          } else if (result.data.operation === 'prepend') {
            applyWithHistory((prev) => result.data.content + prev);
            toast({ title: "Editor Updated", description: "Content prepended. Undo with ⌘Z." });
          } else if (result.data.operation === 'insert') {
            applyWithHistory((prev) => `${prev}\n\n${result.data.content}`);
            toast({ title: "Editor Updated", description: "Content inserted at the end. Undo with ⌘Z." });
          }
        }
        break;

      case 'replace_current_content':
        if (result.data?.content !== undefined) {
          setPendingAgentApply({
            tool: result.tool,
            before: content,
            after: result.data.content,
            reason: result.data.reason || "The agent proposed replacing the document content.",
          });
        }
        break;

      case 'edit_text_with_pattern':
        if (result.data?.content !== undefined) {
          setPendingAgentApply({
            tool: result.tool,
            before: content,
            after: result.data.content,
            reason: result.data.description || `Replaces ${result.data.count ?? 0} pattern match(es).`,
          });
        }
        break;

      case 'improve_current_text':
        if (result.data?.content !== undefined) {
          setPendingAgentApply({
            tool: result.tool,
            before: content,
            after: result.data.content,
            reason: result.data.description || "The agent proposed an improved version.",
          });
        }
        break;

      case 'create_document':
        if (result.data?.title && result.data?.content !== undefined) {
          // Create a real separate document — never overwrite the one being edited.
          if (!activeProjectId) {
            toast({
              title: "No project open",
              description: "Open or create a project first, then ask the agent again.",
              variant: "destructive",
            });
            break;
          }
          apiRequest("POST", "/api/documents", {
            projectId: activeProjectId,
            title: result.data.title,
            content: result.data.content,
          })
            .then((res) => res.json())
            .then(() => {
              queryClient.invalidateQueries({ queryKey: [`/api/projects/${activeProjectId}/documents`] });
              toast({
                title: "Document Created",
                description: `“${result.data.title}” was added to the project. Your current document is untouched.`,
              });
            })
            .catch((err) => {
              toast({ title: "Could not create document", description: err.message, variant: "destructive" });
            });
        }
        break;

      default: {
        // Unknown tools never touch the document silently. Offer an explicit,
        // undoable insert when the result is document-worthy text.
        const text = typeof result.data === 'string' ? result.data : null;
        if (text && text.length > 20) {
          toast({
            title: "Agent result ready",
            description: `${result.tool} produced content. Insert it into the document?`,
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  applyWithHistory((prev) => `${prev}\n\n${text}`);
                  toast({ title: "Inserted", description: "Agent content added at the end. Undo with ⌘Z." });
                }}
              >
                Insert
              </Button>
            ),
            duration: 15000,
          });
        } else {
          toast({
            title: "Agent tool completed",
            description: result.message || `${result.tool} finished — see the agent panel for details.`,
          });
        }
        break;
      }
    }
  }, [activeProjectId, applyWithHistory, content, queryClient, toast]);

  // Smart focus mode switching based on user activity
  useEffect(() => {
    switch (activeTab) {
      case "editor":
        setFocusMode("writing");
        break;
      case "research":
        setFocusMode("researching");
        break;
      case "settings":
        setFocusMode("settings");
        break;
    }
  }, [activeTab]);

  // Handle full screen toggle with smart state management
  const toggleFullScreen = () => {
    if (isFullScreen) {
      // Exiting full screen - restore previous panel states
      setPanelState(preFullScreenState);
      setIsFullScreen(false);
    } else {
      // Entering full screen - save current states and switch to writing mode
      setPreFullScreenState(panelState);
      setPanelState({
        sidebar: 'hidden',
        context: 'hidden',
        header: 'minimal'
      });
      setFocusMode('writing');
      setIsFullScreen(true);
    }
  };

  // AI-driven mode transitions
  const handleModeTransition = (mode: 'writing' | 'organizing' | 'researching' | 'settings') => {
    setFocusMode(mode);
    
    // Map user modes to tabs
    switch (mode) {
      case 'writing':
        setActiveTab('editor');
        break;
      case 'researching':
        setActiveTab('research');
        break;
      case 'settings':
        setActiveTab('settings');
        break;
      case 'organizing':
        // Keep current tab but show sidebar
        break;
    }
  };

  // Handle AI suggestions from components
  const handleAiSuggestions = (suggestions: string) => {
    setAiSuggestions(suggestions);
  };

  // Shell header — always interactive; SmartPanelManager controls height
  const renderMinimalHeader = () => {
    const navBtn =
      "rounded-full px-2.5 py-1.5 text-[12px] sm:text-[13px] text-stone-500 transition-colors hover:bg-stone-100 hover:text-[var(--wp-ink)] dark:hover:bg-stone-800 dark:hover:text-stone-100";
    const activeNav =
      "rounded-full px-2.5 py-1.5 text-[12px] sm:text-[13px] bg-[var(--wp-ink)] text-[var(--wp-paper)] dark:bg-stone-100 dark:text-stone-900";

    return (
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="font-serif text-[15px] font-semibold tracking-tight text-[var(--wp-ink)] dark:text-stone-50 sm:text-base"
            style={{ letterSpacing: '-0.02em' }}
          >
            word<span className="text-[var(--wp-copper)]">Play</span>
          </span>
          {activeProject && (
            <span className="truncate text-[12px] text-stone-500 dark:text-stone-400 sm:text-[13px]">
              <span className="mx-1 text-stone-300 dark:text-stone-600">·</span>
              {activeProject.name}
            </span>
          )}
        </div>
        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1" aria-label="Primary">
          <button
            type="button"
            onClick={() => handleModeTransition('organizing')}
            className={focusMode === 'organizing' ? activeNav : navBtn}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => handleModeTransition('writing')}
            className={focusMode === 'writing' ? activeNav : navBtn}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => handleModeTransition('researching')}
            className={focusMode === 'researching' ? activeNav : navBtn}
          >
            Research
          </button>
          <button
            type="button"
            onClick={() => handleModeTransition('settings')}
            className={focusMode === 'settings' ? activeNav : navBtn}
          >
            Settings
          </button>
        </nav>
      </div>
    );
  };

  // Render the main content based on active tab
  const renderMainContent = () => {
    const commonProps = {
      title,
      setTitle,
      content,
      setContentTyping,
      applyWithHistory,
      undoContent,
      redoContent,
      isSaving,
      isDirty,
      saveError,
      autoSaveEnabled,
      saveDocument,
      llmProvider: settings.llmProvider,
      llmModel: settings.llmModel,
      openaiApiKey: settings.openaiApiKey,
      geminiApiKey: settings.geminiApiKey,
      isFullScreen,
      onToggleFullScreen: toggleFullScreen,
      onOpenFullFeatures: () => handleModeTransition('settings'),
      activeProjectId
    };

    switch (activeTab) {
      case "editor":
        return (
          <UltraMinimalEditor
            {...commonProps}
            onSuggestions={handleAiSuggestions}
          />
        );
      
      case "research":
        return (
          <WebSearch 
            projectId={activeProjectId || undefined}
            contextPanelOpen={panelState.context === 'visible' || panelState.context === 'always-visible'}
            onToggleContextPanel={() => {/* AI will handle this */}}
          />
        );
      
      case "settings":
        return (
          <SettingsPanel
            contextPanelOpen={panelState.context === 'visible' || panelState.context === 'always-visible'}
            onToggleContextPanel={() => {/* AI will handle this */}}
          />
        );
      
      default:
        return (
          <UltraMinimalEditor
            {...commonProps}
          />
        );
    }
  };

  // Always provide panel bodies — SmartPanelManager owns visibility (incl. auto-hide / hover)
  const panelChildren = {
    sidebar: (
      <div className="h-full w-full overflow-hidden">
        <Sidebar
          isOpen={true}
          projects={projects || []}
          activeProjectId={activeProjectId}
          activeTab={activeTab}
          onSelectProject={handleSelectProject}
          onSelectDocument={handleSelectDocument}
          onChangeTab={setActiveTab}
          onClose={() => {
            setPanelState((prev) => ({ ...prev, sidebar: 'hidden' }));
          }}
          userExperienceMode={settings.userExperienceMode}
          onModeChange={(mode) => updateSettings({ userExperienceMode: mode })}
        />
      </div>
    ),

    context: (
      <div className="h-full w-full overflow-hidden">
        <ContextPanel
          title={title || ""}
          content={content || ""}
          documentData={documentData as Document | undefined}
          activeTab={activeTab}
          onClose={() => {
            setPanelState((prev) => ({ ...prev, context: 'hidden' }));
          }}
          aiSuggestions={aiSuggestions}
        />
      </div>
    ),

    header: renderMinimalHeader(),

    main: renderMainContent(),
  };

  // If in full screen mode, render only the ultra-minimal editor
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
        <UltraMinimalEditor
          title={title}
          setTitle={setTitle}
          content={content}
          setContentTyping={setContentTyping}
          applyWithHistory={applyWithHistory}
          undoContent={undoContent}
          redoContent={redoContent}
          isSaving={isSaving}
          isDirty={isDirty}
          saveError={saveError}
          autoSaveEnabled={autoSaveEnabled}
          saveDocument={saveDocument}
          llmProvider={settings.llmProvider}
          llmModel={settings.llmModel}
          openaiApiKey={settings.openaiApiKey}
          geminiApiKey={settings.geminiApiKey}
          isFullScreen={true}
          onToggleFullScreen={toggleFullScreen}
          onOpenFullFeatures={() => handleModeTransition('settings')}
          activeProjectId={activeProjectId}
          onSuggestions={handleAiSuggestions}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--wp-paper)] text-[var(--wp-ink)] transition-colors duration-200 dark:bg-stone-950 dark:text-stone-100">
      <SmartPanelManager
        writingContext={writingContext}
        onPanelStateChange={handlePanelStateChange}
        userExperienceMode={settings.userExperienceMode}
      >
        {panelChildren}
      </SmartPanelManager>

      {/* Modals */}
      <WelcomeModal
        isOpen={welcomeModalOpen}
        onClose={() => {
          // Closing counts as done — otherwise the welcome modal re-appears
          // on every reload and can never be permanently dismissed.
          updateSettings({ hasCompletedOnboarding: true });
          setWelcomeModalOpen(false);
        }}
        onComplete={(userType) => {
          // Mark onboarding complete so the modal doesn't return on reload.
          updateSettings({ hasCompletedOnboarding: true });
          // Adjust default experience based on user preference
          if (userType === 'simple') {
            setPanelState({
              sidebar: 'auto-hide',
              context: 'hidden',
              header: 'minimal'
            });
            updateSettings({ userExperienceMode: 'simple' });
          } else if (userType === 'advanced') {
            setPanelState({
              sidebar: 'visible',
              context: 'contextual',
              header: 'normal'
            });
            updateSettings({ userExperienceMode: 'advanced' });
          } else {
            setPanelState({
              sidebar: 'always-visible',
              context: 'always-visible',
              header: 'full'
            });
            updateSettings({ userExperienceMode: 'expert' });
          }
          setActiveTab('editor');
          setFocusMode('writing');
        }}
      />
      
      <NewProjectModal
        isOpen={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onCreateProject={(project) => {
          setActiveProjectId(project.id);
          setNewProjectModalOpen(false);
          handleModeTransition('organizing');
        }}
      />

      <AgentApplyDialog
        open={!!pendingAgentApply}
        tool={pendingAgentApply?.tool || ""}
        reason={pendingAgentApply?.reason}
        before={pendingAgentApply?.before || ""}
        after={pendingAgentApply?.after || ""}
        newTitle={
          pendingAgentApply?.newTitle && pendingAgentApply.newTitle !== title
            ? pendingAgentApply.newTitle
            : undefined
        }
        onApply={() => {
          if (!pendingAgentApply) return;
          applyWithHistory(pendingAgentApply.after);
          if (pendingAgentApply.newTitle) {
            setTitle(pendingAgentApply.newTitle);
          }
          toast({
            title: "Rewrite applied",
            description: "The agent's version is in the document — undo with ⌘Z if it isn't what you wanted.",
          });
          setPendingAgentApply(null);
        }}
        onCancel={() => {
          setPendingAgentApply(null);
          toast({ title: "Rewrite dismissed", description: "Your document was left untouched." });
        }}
      />
      
      {/* AI Agent - Only show in expert mode for power users */}
      {settings.userExperienceMode === 'expert' && (
        <AIAgent
          currentProject={activeProject}
          currentDocument={documentData}
          llmProvider={settings.llmProvider}
          llmModel={settings.llmModel}
          autonomyLevel={settings.autonomyLevel}
          openaiApiKey={settings.openaiApiKey}
          geminiApiKey={settings.geminiApiKey}
          onToolResult={handleAgentToolResult}
          editorState={{
            title,
            content,
            hasUnsavedChanges: isDirty,
            wordCount: content?.length ? content.trim().split(/\s+/).filter(Boolean).length : 0
          }}
        />
      )}
    </div>
  );
}
