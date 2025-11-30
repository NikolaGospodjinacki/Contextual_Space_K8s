export interface TextBox {
  id: string;
  userId: string;
  username: string;
  content: string;
  positionX: number;
  positionY: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CursorPosition {
  userId: string;
  username: string;
  positionX: number;
  positionY: number;
  color: string;
}

export interface User {
  id: string;
  username: string;
  color: string;
  socketId: string;
}

// Socket.IO event payloads
export interface CreateTextBoxPayload {
  content: string;
  positionX: number;
  positionY: number;
}

export interface UpdateTextBoxPayload {
  id: string;
  content?: string;
  positionX?: number;
  positionY?: number;
}

export interface DeleteTextBoxPayload {
  id: string;
}

export interface CursorMovePayload {
  positionX: number;
  positionY: number;
}

// Reserved area for hiding boxes from other users
export interface ReservedArea {
  id: string;
  userId: string;
  username: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isHidden: boolean;
}

export interface CreateReservedAreaPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UpdateReservedAreaPayload {
  id: string;
  isHidden?: boolean;
}

export interface DeleteReservedAreaPayload {
  id: string;
}

// Server to client events
export interface ServerToClientEvents {
  'textbox:created': (textbox: TextBox) => void;
  'textbox:updated': (textbox: TextBox) => void;
  'textbox:deleted': (id: string) => void;
  'textbox:cleared': () => void;
  'cursor:moved': (cursor: CursorPosition) => void;
  'cursor:left': (userId: string) => void;
  'reservation:created': (area: ReservedArea) => void;
  'reservation:updated': (area: ReservedArea) => void;
  'reservation:deleted': (id: string) => void;
  'reservation:rejected': (tempId: string) => void;
  'sync:initial': (data: { textboxes: TextBox[]; cursors: CursorPosition[]; reservations: ReservedArea[] }) => void;
  'user:joined': (user: { userId: string; username: string; color: string }) => void;
  'user:left': (userId: string) => void;
  'error': (message: string) => void;
}

// Client to server events
export interface ClientToServerEvents {
  'textbox:create': (payload: CreateTextBoxPayload) => void;
  'textbox:update': (payload: UpdateTextBoxPayload) => void;
  'textbox:delete': (payload: DeleteTextBoxPayload) => void;
  'textbox:clear-all': () => void;
  'reservation:create': (payload: CreateReservedAreaPayload) => void;
  'reservation:update': (payload: UpdateReservedAreaPayload) => void;
  'reservation:delete': (payload: DeleteReservedAreaPayload) => void;
  'cursor:move': (payload: CursorMovePayload) => void;
  'user:join': (username: string) => void;
}
