import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PanelState {
  sidebar: 'hidden' | 'auto-hide' | 'visible' | 'always-visible';
  context: 'hidden' | 'contextual' | 'visible' | 'always-visible';
  header: 'minimal' | 'normal' | 'full';
  footer?: 'hidden' | 'minimal' | 'normal';
}

interface WritingContext {
  content: string;
  wordCount: number;
  typingActivity: 'idle' | 'active' | 'intense';
  userMode: 'writing' | 'organizing' | 'researching' | 'settings';
  hasUnsavedChanges: boolean;
  lastActivity: Date;
  aiSuggestionsAvailable: boolean;
  isFullScreen: boolean;
}

interface SmartPanelManagerProps {
  writingContext: WritingContext;
  onPanelStateChange: (state: PanelState) => void;
  userExperienceMode: 'simple' | 'advanced' | 'expert';
  children: {
    sidebar?: React.ReactNode;
    context?: React.ReactNode;
    header?: React.ReactNode;
    main?: React.ReactNode;
  };
  onRequestSidebar?: () => void;
  onRequestContext?: () => void;
}

export default function SmartPanelManager({
  writingContext,
  onPanelStateChange,
  userExperienceMode,
  children,
}: SmartPanelManagerProps) {
  const isMobile = useIsMobile();
  const [currentState, setCurrentState] = useState<PanelState>({
    sidebar: 'auto-hide',
    context: 'contextual',
    header: 'minimal',
  });

  const [hoverSidebar, setHoverSidebar] = useState(false);
  const [hoverContext, setHoverContext] = useState(false);
  const [pinnedSidebar, setPinnedSidebar] = useState(false);
  const [pinnedContext, setPinnedContext] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const determineOptimalState = useCallback(
    (context: WritingContext): PanelState => {
      if (context.isFullScreen) {
        return {
          sidebar: 'hidden',
          context: 'hidden',
          header: 'minimal',
        };
      }

      // Mobile: keep chrome thin; panels open only on demand
      if (isMobile) {
        switch (context.userMode) {
          case 'organizing':
            return { sidebar: 'visible', context: 'hidden', header: 'normal' };
          case 'researching':
            return { sidebar: 'hidden', context: 'visible', header: 'normal' };
          case 'settings':
            return { sidebar: 'hidden', context: 'hidden', header: 'full' };
          case 'writing':
          default:
            return { sidebar: 'hidden', context: 'hidden', header: 'minimal' };
        }
      }

      switch (context.userMode) {
        case 'writing':
          return {
            sidebar: userExperienceMode === 'expert' ? 'auto-hide' : 'auto-hide',
            context:
              context.aiSuggestionsAvailable || userExperienceMode !== 'simple'
                ? 'contextual'
                : 'hidden',
            header: 'minimal',
          };

        case 'organizing':
          return {
            sidebar: 'always-visible',
            context: 'hidden',
            header: 'normal',
          };

        case 'researching':
          return {
            sidebar: 'visible',
            context: 'contextual',
            header: 'normal',
          };

        case 'settings':
          return {
            sidebar: 'visible',
            context: 'hidden',
            header: 'full',
          };

        default:
          return currentState;
      }
    },
    [currentState, isMobile, userExperienceMode]
  );

  const getContextualVisibility = (context: WritingContext) => {
    const optimalState = determineOptimalState(context);

    let sidebarVisible =
      optimalState.sidebar === 'visible' || optimalState.sidebar === 'always-visible';
    let contextVisible =
      optimalState.context === 'visible' || optimalState.context === 'always-visible';

    if (optimalState.sidebar === 'auto-hide') {
      sidebarVisible =
        pinnedSidebar ||
        hoverSidebar ||
        context.userMode === 'organizing';
    }

    if (optimalState.context === 'contextual') {
      contextVisible =
        pinnedContext ||
        hoverContext ||
        context.aiSuggestionsAvailable ||
        context.userMode === 'researching';
    }

    // Hide side chrome while typing intensely (desktop only) — never random
    if (
      !isMobile &&
      context.userMode === 'writing' &&
      context.typingActivity === 'intense' &&
      !pinnedSidebar &&
      !pinnedContext
    ) {
      if (optimalState.sidebar === 'auto-hide') sidebarVisible = false;
      if (optimalState.context === 'contextual' && !context.aiSuggestionsAvailable) {
        contextVisible = false;
      }
    }

    return {
      sidebarVisible,
      contextVisible,
      optimalState,
    };
  };

  useEffect(() => {
    const { optimalState } = getContextualVisibility(writingContext);

    const changed =
      optimalState.sidebar !== currentState.sidebar ||
      optimalState.context !== currentState.context ||
      optimalState.header !== currentState.header;

    if (!changed) return;

    if (!isTransitioning) {
      setIsTransitioning(true);
      const t = setTimeout(() => {
        setCurrentState(optimalState);
        onPanelStateChange(optimalState);
        setIsTransitioning(false);
      }, 160);
      return () => clearTimeout(t);
    }
  }, [writingContext.userMode, writingContext.isFullScreen, writingContext.aiSuggestionsAvailable, isMobile, userExperienceMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;

      if (e.key === 'b') {
        e.preventDefault();
        setPinnedSidebar((p) => {
          const next = !p;
          const sidebar: PanelState['sidebar'] = next ? 'visible' : 'hidden';
          const updated: PanelState = { ...currentState, sidebar };
          setCurrentState(updated);
          onPanelStateChange(updated);
          return next;
        });
      }

      if (e.key === 'i') {
        e.preventDefault();
        setPinnedContext((p) => {
          const next = !p;
          const context: PanelState['context'] = next ? 'visible' : 'hidden';
          const updated: PanelState = { ...currentState, context };
          setCurrentState(updated);
          onPanelStateChange(updated);
          return next;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentState, onPanelStateChange]);

  const { sidebarVisible, contextVisible } = getContextualVisibility(writingContext);
  const showSidebar =
    currentState.sidebar === 'always-visible' || sidebarVisible || pinnedSidebar;
  const showContext =
    currentState.context === 'always-visible' || contextVisible || pinnedContext;

  // Header: minimal is a thin rail — never zero height (nav must stay reachable)
  const headerHeightClass =
    currentState.header === 'minimal'
      ? 'h-12 sm:h-14'
      : currentState.header === 'normal'
        ? 'h-14 sm:h-16'
        : 'h-16 sm:h-20';

  return (
    <div className="relative flex h-full w-full min-h-0">
      {/* Desktop hover edge for auto-hide sidebar */}
      {!isMobile && currentState.sidebar === 'auto-hide' && !showSidebar && (
        <div
          className="fixed left-0 top-0 bottom-0 z-30 w-2 cursor-pointer transition-colors hover:bg-copper-200"
          onMouseEnter={() => setHoverSidebar(true)}
          onMouseLeave={() => setHoverSidebar(false)}
          title="Show navigation (⌘B)"
          aria-hidden
        />
      )}

      {/* Sidebar */}
      {showSidebar && (
        <div
          className={`
            smart-sidebar shrink-0 border-r border-[var(--wp-line)] bg-[var(--wp-paper-elevated)] dark:bg-stone-950 dark:border-stone-800
            ${isMobile ? 'fixed inset-y-0 left-0 z-40 w-[min(100vw-3rem,20rem)] shadow-2xl' : 'w-[min(100%,20rem)] max-w-xs'}
            ${isTransitioning ? 'transition-all duration-200 ease-out' : ''}
          `}
          onMouseEnter={() => !isMobile && setHoverSidebar(true)}
          onMouseLeave={() => !isMobile && setHoverSidebar(false)}
        >
          {children.sidebar}
        </div>
      )}

      {/* Mobile backdrop */}
      {isMobile && (showSidebar || showContext) && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-stone-950/45 backdrop-blur-[2px]"
          aria-label="Close panels"
          onClick={() => {
            setPinnedSidebar(false);
            setPinnedContext(false);
            setHoverSidebar(false);
            setHoverContext(false);
            const updated: PanelState = {
              ...currentState,
              sidebar: 'hidden',
              context: 'hidden',
            };
            setCurrentState(updated);
            onPanelStateChange(updated);
          }}
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {children.header && (
          <div
            className={`
              shrink-0 overflow-hidden border-b border-[var(--wp-line)] bg-[var(--wp-paper)]/90 backdrop-blur-md dark:bg-stone-950/90 dark:border-stone-800
              ${headerHeightClass}
              ${isTransitioning ? 'transition-all duration-200 ease-out' : ''}
            `}
          >
            {children.header}
          </div>
        )}

        <div className="min-h-0 flex-1">{children.main}</div>
      </div>

      {/* Desktop hover edge for context */}
      {!isMobile && currentState.context === 'contextual' && !showContext && (
        <div
          className="fixed right-0 top-0 bottom-0 z-30 w-2 cursor-pointer transition-colors hover:bg-[var(--wp-teal)]/25"
          onMouseEnter={() => setHoverContext(true)}
          onMouseLeave={() => setHoverContext(false)}
          title="Show context (⌘I)"
          aria-hidden
        />
      )}

      {/* Context panel */}
      {showContext && (
        <div
          className={`
            smart-context shrink-0 border-l border-[var(--wp-line)] bg-[var(--wp-paper-elevated)] dark:bg-stone-950 dark:border-stone-800
            ${isMobile ? 'fixed inset-y-0 right-0 z-40 w-[min(100vw-3rem,22rem)] shadow-2xl' : 'w-[min(100%,24rem)] max-w-sm'}
            ${isTransitioning ? 'transition-all duration-200 ease-out' : ''}
          `}
          onMouseEnter={() => !isMobile && setHoverContext(true)}
          onMouseLeave={() => !isMobile && setHoverContext(false)}
        >
          {children.context}
        </div>
      )}
    </div>
  );
}
