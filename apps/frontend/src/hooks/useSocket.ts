import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socket';
import { TextBox, CursorPosition, ReservedArea } from '../types';

export function useSocket(username: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [textboxes, setTextboxes] = useState<TextBox[]>([]);
  const [reservations, setReservations] = useState<ReservedArea[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Connect on mount
  useEffect(() => {
    const connect = async () => {
      try {
        await socketService.connect();
        setIsConnected(true);
        socketService.joinAsUser(username);
      } catch (err) {
        setError('Failed to connect to server');
        console.error(err);
      }
    };

    connect();

    return () => {
      socketService.disconnect();
      cleanupRef.current.forEach((cleanup) => cleanup());
    };
  }, [username]);

  // Setup event listeners
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers: (() => void)[] = [];

    // Initial sync
    unsubscribers.push(
      socketService.onSyncInitial((data) => {
        setTextboxes(data.textboxes);
        setReservations(data.reservations || []);
        const cursorMap = new Map<string, CursorPosition>();
        data.cursors.forEach((cursor) => cursorMap.set(cursor.userId, cursor));
        setCursors(cursorMap);
      })
    );

    // TextBox events
    unsubscribers.push(
      socketService.onTextBoxCreated((textbox) => {
        setTextboxes((prev) => [...prev, textbox]);
      })
    );

    unsubscribers.push(
      socketService.onTextBoxUpdated((textbox) => {
        setTextboxes((prev) =>
          prev.map((t) => (t.id === textbox.id ? textbox : t))
        );
      })
    );

    unsubscribers.push(
      socketService.onTextBoxDeleted((id) => {
        setTextboxes((prev) => prev.filter((t) => t.id !== id));
      })
    );

    unsubscribers.push(
      socketService.onTextBoxesCleared(() => {
        setTextboxes([]);
      })
    );

    // Cursor events
    unsubscribers.push(
      socketService.onCursorMoved((cursor) => {
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(cursor.userId, cursor);
          return next;
        });
      })
    );

    unsubscribers.push(
      socketService.onCursorLeft((userId) => {
        setCursors((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      })
    );

    // Error handling
    unsubscribers.push(
      socketService.onError((message) => {
        setError(message);
        setTimeout(() => setError(null), 5000);
      })
    );

    // Reservation events
    unsubscribers.push(
      socketService.onReservationCreated((reservation) => {
        setReservations((prev) => [...prev, reservation]);
      })
    );

    unsubscribers.push(
      socketService.onReservationUpdated((reservation) => {
        setReservations((prev) =>
          prev.map((r) => (r.id === reservation.id ? reservation : r))
        );
      })
    );

    unsubscribers.push(
      socketService.onReservationDeleted((id) => {
        setReservations((prev) => prev.filter((r) => r.id !== id));
      })
    );

    cleanupRef.current = unsubscribers;

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isConnected]);

  // Actions
  const createTextBox = useCallback(
    (content: string, positionX: number, positionY: number) => {
      socketService.createTextBox({ content, positionX, positionY });
    },
    []
  );

  const updateTextBox = useCallback(
    (id: string, updates: { content?: string; positionX?: number; positionY?: number }) => {
      socketService.updateTextBox({ id, ...updates });
    },
    []
  );

  const deleteTextBox = useCallback((id: string) => {
    socketService.deleteTextBox({ id });
  }, []);

  const clearAllTextBoxes = useCallback(() => {
    socketService.clearAllTextBoxes();
  }, []);

  // Reservation actions
  const createReservation = useCallback(
    (x: number, y: number, width: number, height: number) => {
      socketService.createReservation({ x, y, width, height });
    },
    []
  );

  const updateReservation = useCallback(
    (id: string, updates: { isHidden?: boolean }) => {
      socketService.updateReservation({ id, ...updates });
    },
    []
  );

  const deleteReservation = useCallback((id: string) => {
    socketService.deleteReservation({ id });
  }, []);

  // Optimistic local update for dragging
  const updateTextBoxLocal = useCallback(
    (id: string, updates: { positionX?: number; positionY?: number }) => {
      setTextboxes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const moveCursor = useCallback((positionX: number, positionY: number) => {
    socketService.moveCursor({ positionX, positionY });
  }, []);

  return {
    isConnected,
    textboxes,
    reservations,
    cursors: Array.from(cursors.values()),
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
  };
}
