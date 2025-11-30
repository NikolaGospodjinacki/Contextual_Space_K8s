import React, { useState, useRef, useEffect } from 'react';
import { TextBox as TextBoxType } from '../types';

interface TextBoxProps {
  textbox: TextBoxType;
  isOwner: boolean;
  onUpdate: (id: string, updates: { content?: string; positionX?: number; positionY?: number }) => void;
  onDelete: (id: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export const TextBoxComponent: React.FC<TextBoxProps> = ({
  textbox,
  isOwner,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
  scrollContainerRef,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(textbox.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (isOwner) {
      setIsEditing(true);
      setEditContent(textbox.content);
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      setIsEditing(false);
      if (editContent !== textbox.content) {
        onUpdate(textbox.id, { content: editContent });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(textbox.content);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isOwner || isEditing) return;
    e.preventDefault();
    
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    setIsDragging(true);
    onDragStart?.();
  };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isOwner || isEditing) return;
    // Prevent canvas from scrolling when dragging textbox
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
    }
    setIsDragging(true);
    onDragStart?.();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const scrollLeft = scrollContainerRef?.current?.scrollLeft || 0;
      const scrollTop = scrollContainerRef?.current?.scrollTop || 0;
      const containerRect = scrollContainerRef?.current?.getBoundingClientRect();
      const offsetX = containerRect?.left || 0;
      const offsetY = containerRect?.top || 0;
      const newX = e.clientX - offsetX + scrollLeft - dragOffset.x;
      const newY = e.clientY - offsetY + scrollTop - dragOffset.y;
      onUpdate(textbox.id, { positionX: newX, positionY: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent canvas from scrolling while dragging textbox
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.touches[0];
      const scrollLeft = scrollContainerRef?.current?.scrollLeft || 0;
      const scrollTop = scrollContainerRef?.current?.scrollTop || 0;
      const containerRect = scrollContainerRef?.current?.getBoundingClientRect();
      const offsetX = containerRect?.left || 0;
      const offsetY = containerRect?.top || 0;
      const newX = touch.clientX - offsetX + scrollLeft - dragOffset.x;
      const newY = touch.clientY - offsetY + scrollTop - dragOffset.y;
      onUpdate(textbox.id, { positionX: newX, positionY: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      onDragEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset, textbox.id, onUpdate, onDragEnd]);

  return (
    <div
      ref={boxRef}
      className={`absolute min-w-[120px] max-w-[400px] rounded-lg shadow-lg animate-scale-in
        ${isDragging ? 'cursor-grabbing z-50 opacity-90' : isOwner ? 'cursor-grab' : 'cursor-default'}
        ${isOwner ? 'ring-2 ring-opacity-50' : ''}
      `}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${textbox.positionX}px, ${textbox.positionY}px, 0)`,
        backgroundColor: `${textbox.color}15`,
        borderColor: textbox.color,
        borderWidth: '2px',
        borderStyle: 'solid',
        // Prevent touch gestures on draggable textboxes (mobile)
        touchAction: isOwner ? 'none' : 'auto',
        ...(isOwner && { ringColor: textbox.color }),
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 text-xs font-medium rounded-t-md flex items-center justify-between"
        style={{ backgroundColor: `${textbox.color}30` }}
      >
        <span style={{ color: textbox.color }}>{textbox.username}</span>
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(textbox.id);
            }}
            className="ml-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[60px] bg-transparent text-white resize-none outline-none"
            style={{ color: '#fff' }}
          />
        ) : (
          <p className="text-white whitespace-pre-wrap break-words">
            {textbox.content || <span className="text-gray-500 italic">Empty</span>}
          </p>
        )}
      </div>

      {/* Owner hint */}
      {isOwner && !isEditing && (
        <div className="absolute -bottom-6 left-0 text-xs text-gray-500 opacity-0 hover:opacity-100 transition-opacity">
          Double-click to edit • Drag to move
        </div>
      )}
    </div>
  );
};
