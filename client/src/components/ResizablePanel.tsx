import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ResizablePanelProps {
  children: React.ReactNode;
  side: 'left' | 'right';
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  isOpen: boolean;
  onResize?: (width: number) => void;
  className?: string;
  storageKey?: string;
  disabled?: boolean;
}

const PANEL_DEFAULTS = {
  left: { default: 320, min: 240, max: 0.5 },
  right: { default: 384, min: 240, max: 0.5 }
};

export default function ResizablePanel({
  children,
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  isOpen,
  onResize,
  className,
  storageKey,
  disabled = false
}: ResizablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [width, setWidth] = useState(() => {
    // Try to load from localStorage first
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsedWidth = parseInt(saved, 10);
        if (!isNaN(parsedWidth)) return parsedWidth;
      }
    }
    // Fall back to defaults
    return defaultWidth || PANEL_DEFAULTS[side].default;
  });

  const dragStartPos = useRef<{ x: number; startWidth: number } | null>(null);

  // Calculate constraints
  const getConstraints = useCallback(() => {
    const screenWidth = window.innerWidth;
    const min = minWidth || PANEL_DEFAULTS[side].min;
    const maxRatio = maxWidth || PANEL_DEFAULTS[side].max;
    const max = typeof maxRatio === 'number' && maxRatio <= 1 
      ? screenWidth * maxRatio 
      : (maxRatio as number) || screenWidth * 0.5;
    
    return { min, max };
  }, [minWidth, maxWidth, side]);

  // Save width to localStorage
  const saveWidth = useCallback((newWidth: number) => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newWidth.toString());
    }
  }, [storageKey]);

  // Handle mouse/touch start
  const handleDragStart = useCallback((clientX: number) => {
    if (disabled || !isOpen) return;
    
    setIsDragging(true);
    dragStartPos.current = {
      x: clientX,
      startWidth: width
    };
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    // Add event listeners to document for better drag experience
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [disabled, isOpen, width]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartPos.current) return;
    
    const { x: startX, startWidth } = dragStartPos.current;
    const deltaX = side === 'left' ? e.clientX - startX : startX - e.clientX;
    const newWidth = Math.max(0, startWidth + deltaX);
    
    const { min, max } = getConstraints();
    const constrainedWidth = Math.min(Math.max(newWidth, min), max);
    
    setWidth(constrainedWidth);
    onResize?.(constrainedWidth);
  }, [isDragging, side, getConstraints, onResize]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !dragStartPos.current) return;
    
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const { x: startX, startWidth } = dragStartPos.current;
    const deltaX = side === 'left' ? touch.clientX - startX : startX - touch.clientX;
    const newWidth = Math.max(0, startWidth + deltaX);
    
    const { min, max } = getConstraints();
    const constrainedWidth = Math.min(Math.max(newWidth, min), max);
    
    setWidth(constrainedWidth);
    onResize?.(constrainedWidth);
  }, [isDragging, side, getConstraints, onResize]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    dragStartPos.current = null;
    
    // Restore body styles
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    // Save the final width
    saveWidth(width);
  }, [isDragging, width, saveWidth, handleMouseMove, handleTouchMove]);

  const handleMouseUp = useCallback(() => handleDragEnd(), [handleDragEnd]);
  const handleTouchEnd = useCallback(() => handleDragEnd(), [handleDragEnd]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleDragStart(touch.clientX);
  }, [handleDragStart]);

  // Keyboard accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled || !isOpen) return;
    
    const { min, max } = getConstraints();
    const step = 20; // 20px steps
    let newWidth = width;
    
    switch (e.key) {
      case 'ArrowLeft':
        newWidth = side === 'left' ? Math.max(width - step, min) : Math.min(width + step, max);
        break;
      case 'ArrowRight':
        newWidth = side === 'left' ? Math.min(width + step, max) : Math.max(width - step, min);
        break;
      case 'Home':
        newWidth = min;
        break;
      case 'End':
        newWidth = max;
        break;
      default:
        return;
    }
    
    e.preventDefault();
    setWidth(newWidth);
    onResize?.(newWidth);
    saveWidth(newWidth);
  }, [disabled, isOpen, width, side, getConstraints, onResize, saveWidth]);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      const { min, max } = getConstraints();
      if (width > max) {
        const newWidth = max;
        setWidth(newWidth);
        onResize?.(newWidth);
        saveWidth(newWidth);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [width, getConstraints, onResize, saveWidth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Respect reduced motion preferences
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  if (!isOpen) return null;

  const dragHandlePosition = side === 'left' ? 'right-0' : 'left-0';
  const dragHandleTransform = side === 'left' ? 'translate-x-1/2' : '-translate-x-1/2';

  return (
    <div
      ref={panelRef}
      className={cn(
        'relative h-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
        side === 'left' ? 'border-r' : 'border-l',
        !prefersReducedMotion && 'transition-all duration-200 ease-in-out',
        isDragging && 'select-none',
        className
      )}
      style={{ 
        width: `${width}px`,
        ...(isDragging && { transition: 'none' })
      }}
    >
      {children}
      
      {/* Drag Handle */}
      <div
        ref={dragHandleRef}
        className={cn(
          'absolute top-0 bottom-0 w-1 group cursor-col-resize z-10',
          dragHandlePosition,
          dragHandleTransform,
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${side} panel`}
        aria-valuemin={getConstraints().min}
        aria-valuemax={getConstraints().max}
        aria-valuenow={width}
      >
        {/* Visual drag handle */}
        <div 
          className={cn(
            'absolute inset-y-0 w-1 bg-transparent group-hover:bg-blue-300 dark:group-hover:bg-blue-600',
            'transition-colors duration-150',
            (isDragging || isHovering) && 'bg-blue-400 dark:bg-blue-500',
            disabled && 'bg-gray-300 dark:bg-gray-600'
          )}
        />
        
        {/* Drag indicator dots */}
        <div 
          className={cn(
            'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
            'w-1 h-8 flex flex-col justify-center items-center gap-0.5',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            (isDragging || isHovering) && 'opacity-100',
            disabled && 'opacity-50'
          )}
        >
          <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-300 rounded-full" />
          <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-300 rounded-full" />
          <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-300 rounded-full" />
          <div className="w-0.5 h-0.5 bg-gray-600 dark:bg-gray-300 rounded-full" />
        </div>
      </div>
      
      {/* Visual feedback during drag */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 pointer-events-none opacity-50" />
      )}
    </div>
  );
}