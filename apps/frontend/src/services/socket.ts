import { io, Socket } from 'socket.io-client';
import {
  TextBox,
  CursorPosition,
  ReservedArea,
  CreateTextBoxPayload,
  UpdateTextBoxPayload,
  DeleteTextBoxPayload,
  CreateReservedAreaPayload,
  UpdateReservedAreaPayload,
  DeleteReservedAreaPayload,
  CursorMovePayload,
  SyncData,
} from '../types';

// Get base path for K8s routing (e.g., /pr-123/)
const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/';

// Socket URL - in K8s, we use relative path through ingress
const getSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  // Only use envUrl if it's explicitly set to a non-empty value
  if (envUrl && envUrl.trim()) return envUrl;
  
  // Check if we're in production (not localhost)
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return window.location.origin;
  }
  
  // If we have a base path (K8s deployment), use current origin
  if (BASE_PATH !== '/') {
    return window.location.origin;
  }
  
  // Default for local development
  return 'http://localhost:3001';
};

// Socket.IO path - append to base path for K8s routing
const getSocketPath = (): string => {
  if (BASE_PATH !== '/') {
    return BASE_PATH + 'socket.io';
  }
  return '/socket.io';
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(SOCKET_URL, {
        path: getSocketPath(),
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        upgrade: true,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected:', this.socket?.id);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      // Setup event forwarding
      this.setupEventForwarding();
    });
  }

  private setupEventForwarding(): void {
    if (!this.socket) return;

    const events = [
      'textbox:created',
      'textbox:updated',
      'textbox:deleted',
      'textbox:cleared',
      'cursor:moved',
      'cursor:left',
      'reservation:created',
      'reservation:updated',
      'reservation:deleted',
      'reservation:rejected',
      'sync:initial',
      'user:joined',
      'user:left',
      'error',
    ];

    events.forEach((event) => {
      this.socket?.on(event, (data: unknown) => {
        this.emit(event, data);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Event subscription
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  // User actions
  joinAsUser(username: string): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot join - socket not connected yet');
      // Try again after a short delay
      setTimeout(() => this.joinAsUser(username), 100);
      return;
    }
    console.log('[Socket] Sending user:join with username:', username);
    this.socket.emit('user:join', username);
  }

  // TextBox actions
  createTextBox(payload: CreateTextBoxPayload): void {
    this.socket?.emit('textbox:create', payload);
  }

  updateTextBox(payload: UpdateTextBoxPayload): void {
    this.socket?.emit('textbox:update', payload);
  }

  deleteTextBox(payload: DeleteTextBoxPayload): void {
    this.socket?.emit('textbox:delete', payload);
  }

  clearAllTextBoxes(): void {
    this.socket?.emit('textbox:clear-all');
  }

  // Reservation actions
  createReservation(payload: CreateReservedAreaPayload): void {
    this.socket?.emit('reservation:create', payload);
  }

  updateReservation(payload: UpdateReservedAreaPayload): void {
    this.socket?.emit('reservation:update', payload);
  }

  deleteReservation(payload: DeleteReservedAreaPayload): void {
    this.socket?.emit('reservation:delete', payload);
  }

  // Cursor actions
  moveCursor(payload: CursorMovePayload): void {
    this.socket?.emit('cursor:move', payload);
  }

  // Type-safe event listeners
  onSyncInitial(callback: (data: SyncData) => void): () => void {
    return this.on('sync:initial', callback);
  }

  onTextBoxCreated(callback: (textbox: TextBox) => void): () => void {
    return this.on('textbox:created', callback);
  }

  onTextBoxUpdated(callback: (textbox: TextBox) => void): () => void {
    return this.on('textbox:updated', callback);
  }

  onTextBoxDeleted(callback: (id: string) => void): () => void {
    return this.on('textbox:deleted', callback);
  }

  onTextBoxesCleared(callback: () => void): () => void {
    return this.on('textbox:cleared', callback);
  }

  onCursorMoved(callback: (cursor: CursorPosition) => void): () => void {
    return this.on('cursor:moved', callback);
  }

  onCursorLeft(callback: (userId: string) => void): () => void {
    return this.on('cursor:left', callback);
  }

  onReservationCreated(callback: (reservation: ReservedArea) => void): () => void {
    return this.on('reservation:created', callback);
  }

  onReservationUpdated(callback: (reservation: ReservedArea) => void): () => void {
    return this.on('reservation:updated', callback);
  }

  onReservationDeleted(callback: (id: string) => void): () => void {
    return this.on('reservation:deleted', callback);
  }

  onReservationRejected(callback: (tempId: string) => void): () => void {
    return this.on('reservation:rejected', callback);
  }

  onError(callback: (message: string) => void): () => void {
    return this.on('error', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const socketService = new SocketService();
