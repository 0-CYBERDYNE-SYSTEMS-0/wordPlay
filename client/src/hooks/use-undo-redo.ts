import { useState, useCallback, useRef, useEffect } from 'react';

interface UndoRedoState {
  title: string;
  content: string;
}

interface UseUndoRedoOptions {
  maxHistorySize?: number;
  debounceMs?: number;
}

export function useUndoRedo(
  initialState: UndoRedoState,
  options: UseUndoRedoOptions = {}
) {
  const { maxHistorySize = 50, debounceMs = 300 } = options;
  
  // History stack
  const [history, setHistory] = useState<UndoRedoState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Track if we're currently applying an undo/redo to prevent loops
  const isApplyingHistory = useRef(false);
  const lastAppliedState = useRef<UndoRedoState | null>(null);
  
  // Debounce timer to prevent excessive history entries
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Current state
  const currentState = history[currentIndex];
  
  // Whether undo/redo is available
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  
  // Add new state to history (debounced)
  const pushState = useCallback((newState: UndoRedoState) => {
    // Don't add to history if we're applying undo/redo
    if (isApplyingHistory.current) {
      return;
    }
    
    // Don't add if this is the same as the last applied state (prevents loops from external updates)
    if (lastAppliedState.current && 
        lastAppliedState.current.title === newState.title && 
        lastAppliedState.current.content === newState.content) {
      lastAppliedState.current = null; // Clear the flag
      return;
    }
    
    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new debounce timer
    debounceTimer.current = setTimeout(() => {
      setHistory(prevHistory => {
        // Don't add if state hasn't changed
        const lastState = prevHistory[prevHistory.length - 1];
        if (lastState && 
            lastState.title === newState.title && 
            lastState.content === newState.content) {
          return prevHistory;
        }
        
        // Remove any states after current index (we're branching)
        const newHistory = prevHistory.slice(0, currentIndex + 1);
        
        // Add new state
        newHistory.push(newState);
        
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          setCurrentIndex(prev => Math.max(0, prev - 1));
        } else {
          setCurrentIndex(newHistory.length - 1);
        }
        
        return newHistory;
      });
    }, debounceMs);
  }, [currentIndex, maxHistorySize, debounceMs]);
  
  // Undo function
  const undo = useCallback(() => {
    if (!canUndo) return null;
    
    isApplyingHistory.current = true;
    
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    const previousState = history[newIndex];
    
    // Remember this state to prevent re-adding it to history
    lastAppliedState.current = previousState;
    
    // Reset the flag after a short delay to allow state updates to propagate
    setTimeout(() => {
      isApplyingHistory.current = false;
    }, 100);
    
    return previousState;
  }, [canUndo, currentIndex, history]);
  
  // Redo function
  const redo = useCallback(() => {
    if (!canRedo) return null;
    
    isApplyingHistory.current = true;
    
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    const nextState = history[newIndex];
    
    // Remember this state to prevent re-adding it to history
    lastAppliedState.current = nextState;
    
    // Reset the flag after a short delay to allow state updates to propagate
    setTimeout(() => {
      isApplyingHistory.current = false;
    }, 100);
    
    return nextState;
  }, [canRedo, currentIndex, history]);
  
  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([currentState]);
    setCurrentIndex(0);
    lastAppliedState.current = null;
  }, [currentState]);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);
  
  return {
    currentState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historySize: history.length,
    currentIndex,
    isApplyingHistory: () => isApplyingHistory.current
  };
} 