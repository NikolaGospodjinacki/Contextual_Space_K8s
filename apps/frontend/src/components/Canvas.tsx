import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { TextBoxComponent } from './TextBox';
import { OtherCursor } from './OtherCursor';
import { soundService } from '../services/sound';

interface CanvasProps {
  username: string;
}

// Canvas dimensions for scrollable area
const CANVAS_WIDTH = 5000;
const CANVAS_HEIGHT = 5000;

export const Canvas: React.FC<CanvasProps> = ({ username }) => {
  const {
    isConnected,
    textboxes,
    reservations,
    cursors,
    error,
    createTextBox,
    updateTextBox,
    updateTextBoxLocal,
    deleteTextBox,
    clearAllTextBoxes,
    createReservation,
    updateReservation,
    deleteReservation,
    moveCursor,
  } = useSocket(username);

  const [isCreating, setIsCreating] = useState(false);
  const [newBoxPosition, setNewBoxPosition] = useState({ x: 0, y: 0 });
  const [newBoxContent, setNewBoxContent] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Reserved area feature - local drawing state and pending reservations
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [reserveMode, setReserveMode] = useState(false); // Toggle with button
  const [areaStart, setAreaStart] = useState({ x: 0, y: 0 });
  const [tempArea, setTempArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pendingReservations, setPendingReservations] = useState<{ id: string; x: number; y: number; width: number; height: number }[]>([]);
  
  // Search/filter feature
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'username' | 'content'>('all');
  
  // Throttle ref for dragging updates
  const dragThrottleRef = useRef(0);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorUpdate = useRef(0);
  const textboxRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Update sound service when toggle changes
  useEffect(() => {
    soundService.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Get the current user's reservations
  const myReservations = reservations.filter((r) => r.username === username);

  // Check if a new area overlaps with existing reservations
  const checkOverlap = (newArea: { x: number; y: number; width: number; height: number }): boolean => {
    for (const reservation of reservations) {
      const aLeft = newArea.x;
      const aRight = newArea.x + newArea.width;
      const aTop = newArea.y;
      const aBottom = newArea.y + newArea.height;
      
      const bLeft = reservation.x;
      const bRight = reservation.x + reservation.width;
      const bTop = reservation.y;
      const bBottom = reservation.y + reservation.height;
      
      if (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop) {
        return true; // Overlaps
      }
    }
    // Also check pending reservations
    for (const pending of pendingReservations) {
      const aLeft = newArea.x;
      const aRight = newArea.x + newArea.width;
      const aTop = newArea.y;
      const aBottom = newArea.y + newArea.height;
      
      const bLeft = pending.x;
      const bRight = pending.x + pending.width;
      const bTop = pending.y;
      const bBottom = pending.y + pending.height;
      
      if (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop) {
        return true;
      }
    }
    return false;
  };

  // Throttled cursor movement
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Area selection
      if (isSelectingArea) {
        const rect = scrollContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const currentX = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
          const currentY = e.clientY - rect.top + (scrollContainerRef.current?.scrollTop || 0);
          
          setTempArea({
            x: Math.min(areaStart.x, currentX),
            y: Math.min(areaStart.y, currentY),
            width: Math.abs(currentX - areaStart.x),
            height: Math.abs(currentY - areaStart.y),
          });
        }
        return;
      }

      const now = Date.now();
      if (now - lastCursorUpdate.current > 50) {
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const scrollTop = scrollContainerRef.current?.scrollTop || 0;
        moveCursor(e.clientX + scrollLeft, e.clientY + scrollTop);
        lastCursorUpdate.current = now;
      }
    },
    [moveCursor, isSelectingArea, areaStart]
  );

  // Handle canvas click to create new textbox
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Ignore if clicking on existing elements
    if ((e.target as HTMLElement).closest('.textbox-container, .control-panel')) {
      return;
    }

    // Ignore if selecting area or in reserve mode
    if (isSelectingArea || reserveMode) return;

    const rect = scrollContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
    
    const clickX = e.clientX - rect.left + scrollLeft;
    const clickY = e.clientY - rect.top + scrollTop;

    setNewBoxPosition({ x: clickX, y: clickY });
    setIsCreating(true);
    setNewBoxContent('');
    soundService.playClick();
  };

  // Handle mouse down for area selection
  const handleMouseDown = (e: React.MouseEvent) => {
    // Start area selection when in reserve mode
    if (e.button === 0 && reserveMode && !isCreating) {
      e.preventDefault();
      const rect = scrollContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const scrollTop = scrollContainerRef.current?.scrollTop || 0;
        const startX = e.clientX - rect.left + scrollLeft;
        const startY = e.clientY - rect.top + scrollTop;
        
        setAreaStart({ x: startX, y: startY });
        setTempArea({ x: startX, y: startY, width: 0, height: 0 });
        setIsSelectingArea(true);
        soundService.playClick();
      }
    }
  };

  const handleMouseUp = () => {
    if (isSelectingArea) {
      setIsSelectingArea(false);
      setReserveMode(false); // Exit reserve mode after selection
      if (tempArea && tempArea.width > 50 && tempArea.height > 50) {
        // Check for local overlaps first
        if (checkOverlap(tempArea)) {
          soundService.playClick(); // Error sound
          setTempArea(null);
          return;
        }
        // Add to pending and create on server
        const pendingId = `pending-${Date.now()}`;
        setPendingReservations(prev => [...prev, { id: pendingId, ...tempArea }]);
        createReservation(tempArea.x, tempArea.y, tempArea.width, tempArea.height);
        soundService.playSuccess();
      }
      setTempArea(null);
    }
  };

  // Touch handlers for area selection on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (reserveMode && !isCreating) {
      const touch = e.touches[0];
      const rect = scrollContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const scrollTop = scrollContainerRef.current?.scrollTop || 0;
        const startX = touch.clientX - rect.left + scrollLeft;
        const startY = touch.clientY - rect.top + scrollTop;
        
        setAreaStart({ x: startX, y: startY });
        setTempArea({ x: startX, y: startY, width: 0, height: 0 });
        setIsSelectingArea(true);
        soundService.playClick();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSelectingArea) {
      const touch = e.touches[0];
      const rect = scrollContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = touch.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
        const currentY = touch.clientY - rect.top + (scrollContainerRef.current?.scrollTop || 0);
        
        setTempArea({
          x: Math.min(areaStart.x, currentX),
          y: Math.min(areaStart.y, currentY),
          width: Math.abs(currentX - areaStart.x),
          height: Math.abs(currentY - areaStart.y),
        });
      }
    }
  };

  const handleTouchEnd = () => {
    if (isSelectingArea) {
      setIsSelectingArea(false);
      setReserveMode(false);
      if (tempArea && tempArea.width > 50 && tempArea.height > 50) {
        // Check for local overlaps first
        if (checkOverlap(tempArea)) {
          soundService.playClick(); // Error sound
          setTempArea(null);
          return;
        }
        // Add to pending and create on server
        const pendingId = `pending-${Date.now()}`;
        setPendingReservations(prev => [...prev, { id: pendingId, ...tempArea }]);
        createReservation(tempArea.x, tempArea.y, tempArea.width, tempArea.height);
        soundService.playSuccess();
      }
      setTempArea(null);
    }
  };

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Handle create submission
  const handleCreateSubmit = () => {
    if (newBoxContent.trim()) {
      createTextBox(newBoxContent.trim(), newBoxPosition.x, newBoxPosition.y);
      soundService.playPop();
    }
    setIsCreating(false);
    setNewBoxContent('');
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateSubmit();
    }
    if (e.key === 'Escape') {
      setIsCreating(false);
      setNewBoxContent('');
      soundService.playClick();
    }
  };

  // Handle textbox update with optimistic local update for smooth dragging
  const handleTextBoxUpdate = useCallback(
    (id: string, updates: { content?: string; positionX?: number; positionY?: number }) => {
      if (updates.positionX !== undefined && updates.positionY !== undefined) {
        // Update local state immediately for smooth dragging
        updateTextBoxLocal(id, { positionX: updates.positionX, positionY: updates.positionY });
        
        // Throttle server updates to reduce lag
        const now = Date.now();
        if (now - dragThrottleRef.current > 50) { // 50ms throttle
          dragThrottleRef.current = now;
          updateTextBox(id, updates);
        }
      } else {
        updateTextBox(id, updates);
      }
    },
    [updateTextBox, updateTextBoxLocal]
  );

  // Handle delete with sound
  const handleDelete = useCallback(
    (id: string) => {
      deleteTextBox(id);
      soundService.playDelete();
    },
    [deleteTextBox]
  );

  // Toggle reserved area visibility (server-side) - now per reservation
  const toggleReservedVisibility = (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation) {
      updateReservation(reservation.id, { isHidden: !reservation.isHidden });
      soundService.playToggle(!reservation.isHidden);
    }
  };

  // Clear a specific reserved area (delete from server)
  const clearReservedArea = (reservationId: string) => {
    deleteReservation(reservationId);
    soundService.playClick();
  };

  // Clear all of my reserved areas
  const clearAllMyReservations = () => {
    myReservations.forEach(r => deleteReservation(r.id));
    soundService.playDelete();
  };

  // Clear pending reservations when server confirms
  useEffect(() => {
    // When reservations change, remove matching pending ones
    if (pendingReservations.length > 0) {
      setPendingReservations(prev => {
        // Remove pending if a real reservation now exists at same position
        return prev.filter(pending => {
          const exists = reservations.some(r => 
            Math.abs(r.x - pending.x) < 10 && 
            Math.abs(r.y - pending.y) < 10
          );
          return !exists;
        });
      });
    }
  }, [reservations, pendingReservations.length]);

  // Get current user ID from first textbox they own
  const currentUserId = textboxes.find((t) => t.username === username)?.userId;

  // Helper to check if a textbox is in a hidden reserved area (not ours)
  const isTextBoxHidden = (tb: typeof textboxes[0]): boolean => {
    for (const reservation of reservations) {
      // Skip our own reservations - we can always see everything in our own areas
      if (reservation.username === username) continue;
      // Skip non-hidden reservations
      if (!reservation.isHidden) continue;
      
      // Check if textbox is inside this hidden reservation
      // ALL textboxes in a hidden area are hidden from non-owners
      if (
        tb.positionX >= reservation.x &&
        tb.positionX <= reservation.x + reservation.width &&
        tb.positionY >= reservation.y &&
        tb.positionY <= reservation.y + reservation.height
      ) {
        return true;
      }
    }
    return false;
  };

  // Filter textboxes: remove those in others' hidden reservations, then apply search
  const visibleTextboxes = textboxes.filter((tb) => {
    // First filter by reservation visibility
    if (isTextBoxHidden(tb)) return false;
    
    // Then apply search filter
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    switch (searchMode) {
      case 'username':
        return tb.username.toLowerCase().includes(query);
      case 'content':
        return tb.content.toLowerCase().includes(query);
      case 'all':
      default:
        return (
          tb.username.toLowerCase().includes(query) ||
          tb.content.toLowerCase().includes(query)
        );
    }
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Control Panel */}
      <div className="control-panel absolute top-4 left-4 z-50 flex flex-col gap-2">
        {/* Connection status */}
        <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Sound toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg hover:bg-gray-800/80 transition-colors"
        >
          <span className="text-sm">{soundEnabled ? '🔊' : '🔇'}</span>
          <span className="text-xs text-gray-400">Sound</span>
        </button>

        {/* Search/Filter */}
        <div className="flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg">
          <div className="flex items-center gap-1">
            <span className="text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-24 bg-gray-800 text-white text-xs px-2 py-1 rounded outline-none focus:ring-1 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="flex gap-1">
              <button
                onClick={() => setSearchMode('all')}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  searchMode === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSearchMode('username')}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  searchMode === 'username' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                User
              </button>
              <button
                onClick={() => setSearchMode('content')}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  searchMode === 'content' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Text
              </button>
            </div>
          )}
          {searchQuery && (
            <span className="text-xs text-gray-400">
              {visibleTextboxes.length} of {textboxes.length} shown
            </span>
          )}
        </div>

        {/* Reserve mode toggle */}
        <button
          onClick={() => {
            setReserveMode(!reserveMode);
            soundService.playClick();
          }}
          className={`flex items-center gap-2 backdrop-blur-sm px-3 py-2 rounded-lg transition-colors ${
            reserveMode 
              ? 'bg-teal-600 hover:bg-teal-500' 
              : 'bg-gray-900/80 hover:bg-gray-800/80'
          }`}
        >
          <span className="text-sm">📐</span>
          <span className="text-xs text-white">{reserveMode ? 'Drawing...' : 'Reserve Area'}</span>
        </button>

        {/* Reserved area controls - one per reservation */}
        {myReservations.length > 0 && (
          <div className="flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Your Areas ({myReservations.length})</span>
              {myReservations.length > 1 && (
                <button
                  onClick={clearAllMyReservations}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear All
                </button>
              )}
            </div>
            {myReservations.map((reservation, index) => (
              <div key={reservation.id} className="flex gap-1 items-center">
                <span className="text-xs text-gray-500">#{index + 1}</span>
                <button
                  onClick={() => toggleReservedVisibility(reservation.id)}
                  className={`text-xs px-2 py-0.5 rounded transition-colors text-white flex-1 ${
                    reservation.isHidden ? 'bg-teal-600 hover:bg-teal-500' : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                >
                  {reservation.isHidden ? '👁️ Hidden' : '👁️ Visible'}
                </button>
                <button
                  onClick={() => clearReservedArea(reservation.id)}
                  className="text-xs px-1.5 py-0.5 bg-red-700 hover:bg-red-600 rounded transition-colors text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dev: Clear All button */}
        <button
          onClick={() => {
            if (confirm('Clear ALL textboxes for everyone? This cannot be undone.')) {
              clearAllTextBoxes();
              soundService.playDelete();
            }
          }}
          className="flex items-center gap-2 bg-red-900/80 backdrop-blur-sm px-3 py-2 rounded-lg hover:bg-red-800/80 transition-colors"
        >
          <span className="text-sm">🗑️</span>
          <span className="text-xs text-white">Clear All</span>
        </button>
      </div>

      {/* User info */}
      <div className="absolute top-4 right-4 z-50 text-sm text-gray-400 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg">
        Signed in as <span className="text-white font-medium">{username}</span>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 text-center bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg max-w-[90vw]">
        <p className="text-gray-400 text-xs sm:text-sm">
          {reserveMode 
            ? 'Tap and drag to draw your reserved area' 
            : 'Tap to add • Double-tap to edit • Drag to move'}
        </p>
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {error}
        </div>
      )}

      {/* Scrollable canvas container */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            backgroundColor: '#0a0a0a',
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
          onClick={handleCanvasClick}
        >
          {/* Temporary area being drawn */}
          {tempArea && isSelectingArea && (
            <div
              className="absolute border-2 border-dashed border-teal-400 bg-teal-400/10 pointer-events-none"
              style={{
                left: tempArea.x,
                top: tempArea.y,
                width: tempArea.width,
                height: tempArea.height,
              }}
            />
          )}

          {/* All reservations visualization */}
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className={`absolute border-2 border-dashed pointer-events-none transition-colors ${
                reservation.username === username
                  ? (reservation.isHidden ? 'border-teal-500 bg-teal-500/10' : 'border-teal-400 bg-teal-400/5')
                  : (reservation.isHidden ? 'border-gray-600 bg-gray-600/5' : 'border-gray-500 bg-gray-500/5')
              }`}
              style={{
                left: reservation.x,
                top: reservation.y,
                width: reservation.width,
                height: reservation.height,
              }}
            >
              <div className="absolute top-2 left-2 text-xs text-gray-400 bg-gray-900/80 px-2 py-1 rounded">
                {reservation.username === username 
                  ? `Your Space #${myReservations.findIndex(r => r.id === reservation.id) + 1}` 
                  : `${reservation.username}'s Space`}
                {reservation.isHidden && ' (Hidden)'}
              </div>
            </div>
          ))}

          {/* Pending reservations (optimistic UI) */}
          {pendingReservations.map((pending) => (
            <div
              key={pending.id}
              className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/10 pointer-events-none animate-pulse"
              style={{
                left: pending.x,
                top: pending.y,
                width: pending.width,
                height: pending.height,
              }}
            >
              <div className="absolute top-2 left-2 text-xs text-yellow-400 bg-gray-900/80 px-2 py-1 rounded">
                Creating...
              </div>
            </div>
          ))}

          {/* Other users' cursors */}
          {cursors.map((cursor) => (
            <OtherCursor key={cursor.userId} cursor={cursor} />
          ))}

          {/* Existing textboxes */}
          {visibleTextboxes.map((textbox) => (
            <div
              key={textbox.id}
              className="textbox-container"
              ref={(el) => {
                if (el) textboxRefs.current.set(textbox.id, el);
                else textboxRefs.current.delete(textbox.id);
              }}
            >
              <TextBoxComponent
                textbox={textbox}
                isOwner={textbox.userId === currentUserId || textbox.username === username}
                onUpdate={handleTextBoxUpdate}
                onDelete={handleDelete}
                onDragStart={() => soundService.playWhoosh()}
                onDragEnd={() => soundService.playPop()}
                scrollContainerRef={scrollContainerRef}
              />
            </div>
          ))}

          {/* New textbox creation input */}
          {isCreating && (
            <div
              className="absolute z-40 animate-scale-in"
              style={{
                left: newBoxPosition.x,
                top: newBoxPosition.y,
              }}
            >
              <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-600 p-3 min-w-[200px]">
                <textarea
                  ref={inputRef}
                  value={newBoxContent}
                  onChange={(e) => setNewBoxContent(e.target.value)}
                  onBlur={handleCreateSubmit}
                  onKeyDown={handleCreateKeyDown}
                  placeholder="Type your note..."
                  className="w-full min-h-[60px] bg-transparent text-white resize-none outline-none placeholder-gray-500"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      soundService.playClick();
                    }}
                    className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSubmit}
                    className="px-3 py-1 text-sm bg-teal-600 text-white rounded hover:bg-teal-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
