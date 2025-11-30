// Types shared between frontend and backend
// In production, these would be in a shared package

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
}

// Socket event payloads
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

// Reserved area on canvas
export interface ReservedArea {
  id: string;
  userId: string;
  username: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isHidden: boolean; // Whether textboxes in this area are hidden from others
}

// Reservation payloads
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

// Initial sync data
export interface SyncData {
  textboxes: TextBox[];
  cursors: CursorPosition[];
  reservations: ReservedArea[];
}
