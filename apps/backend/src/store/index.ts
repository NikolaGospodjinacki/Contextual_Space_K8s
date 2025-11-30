import { TextBox, User, CursorPosition, ReservedArea } from '../types';
import { dynamoStore } from './dynamodb';

/**
 * Hybrid store that uses DynamoDB for persistent textboxes
 * and in-memory storage for session-based data (users, cursors, reservations)
 */
class Store {
  private users: Map<string, User> = new Map();
  private cursors: Map<string, CursorPosition> = new Map();
  private reservations: Map<string, ReservedArea> = new Map();
  
  // Local cache for textboxes (synced with DynamoDB)
  private textboxCache: Map<string, TextBox> = new Map();
  private cacheInitialized: boolean = false;

  // TextBox operations - now async with DynamoDB
  async initializeCache(): Promise<void> {
    if (this.cacheInitialized) return;
    try {
      const textboxes = await dynamoStore.getAllTextBoxes();
      textboxes.forEach(tb => this.textboxCache.set(tb.id, tb));
      this.cacheInitialized = true;
      console.log(`[Store] Loaded ${textboxes.length} textboxes from database`);
    } catch (error) {
      console.error('[Store] Failed to initialize cache from DynamoDB:', error);
      // Continue with empty cache - will work with in-memory fallback
      this.cacheInitialized = true;
    }
  }

  getAllTextBoxes(): TextBox[] {
    return Array.from(this.textboxCache.values());
  }

  getTextBox(id: string): TextBox | undefined {
    return this.textboxCache.get(id);
  }

  async createTextBox(textbox: TextBox): Promise<TextBox> {
    // Update local cache first for responsiveness
    this.textboxCache.set(textbox.id, textbox);
    
    // Persist to DynamoDB async
    try {
      await dynamoStore.createTextBox(textbox);
    } catch (error) {
      console.error('[Store] Failed to persist textbox to DynamoDB:', error);
      // Keep in cache anyway for session continuity
    }
    
    return textbox;
  }

  async updateTextBox(id: string, updates: Partial<TextBox>): Promise<TextBox | undefined> {
    const existing = this.textboxCache.get(id);
    if (!existing) return undefined;

    const updated: TextBox = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID override
      updatedAt: new Date().toISOString(),
    };

    // Update local cache first
    this.textboxCache.set(id, updated);
    
    // Persist to DynamoDB async
    try {
      await dynamoStore.updateTextBox(id, updates);
    } catch (error) {
      console.error('[Store] Failed to update textbox in DynamoDB:', error);
    }
    
    return updated;
  }

  async deleteTextBox(id: string): Promise<boolean> {
    const deleted = this.textboxCache.delete(id);
    
    if (deleted) {
      try {
        await dynamoStore.deleteTextBox(id);
      } catch (error) {
        console.error('[Store] Failed to delete textbox from DynamoDB:', error);
      }
    }
    
    return deleted;
  }

  async clearAllTextBoxes(): Promise<void> {
    const ids = Array.from(this.textboxCache.keys());
    this.textboxCache.clear();
    
    // Delete from DynamoDB in parallel
    try {
      await Promise.all(ids.map(id => dynamoStore.deleteTextBox(id)));
      console.log(`[Store] Cleared ${ids.length} textboxes from database`);
    } catch (error) {
      console.error('[Store] Failed to clear textboxes from DynamoDB:', error);
    }
  }

  // User operations
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserBySocketId(socketId: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.socketId === socketId);
  }

  addUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  removeUser(id: string): boolean {
    this.cursors.delete(id);
    return this.users.delete(id);
  }

  removeUserBySocketId(socketId: string): User | undefined {
    const user = this.getUserBySocketId(socketId);
    if (user) {
      this.removeUser(user.id);
    }
    return user;
  }

  // Cursor operations
  getAllCursors(): CursorPosition[] {
    return Array.from(this.cursors.values());
  }

  updateCursor(cursor: CursorPosition): void {
    this.cursors.set(cursor.userId, cursor);
  }

  removeCursor(userId: string): boolean {
    return this.cursors.delete(userId);
  }

  // Reservation operations (in-memory only, session-based)
  getAllReservations(): ReservedArea[] {
    return Array.from(this.reservations.values());
  }

  getReservation(id: string): ReservedArea | undefined {
    return this.reservations.get(id);
  }

  getReservationsByUserId(userId: string): ReservedArea[] {
    return Array.from(this.reservations.values()).filter(r => r.userId === userId);
  }

  // Check if a new reservation would overlap with existing ones
  checkReservationOverlap(newArea: { x: number; y: number; width: number; height: number }, excludeId?: string): ReservedArea | null {
    for (const reservation of this.reservations.values()) {
      if (excludeId && reservation.id === excludeId) continue;
      
      // Check if rectangles overlap
      const aLeft = newArea.x;
      const aRight = newArea.x + newArea.width;
      const aTop = newArea.y;
      const aBottom = newArea.y + newArea.height;
      
      const bLeft = reservation.x;
      const bRight = reservation.x + reservation.width;
      const bTop = reservation.y;
      const bBottom = reservation.y + reservation.height;
      
      // Rectangles overlap if they intersect on both axes
      if (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop) {
        return reservation; // Return the overlapping reservation
      }
    }
    return null;
  }

  createReservation(reservation: ReservedArea): ReservedArea | null {
    // Check for overlaps with existing reservations
    const overlap = this.checkReservationOverlap(reservation);
    if (overlap) {
      return null; // Cannot create - overlaps with existing
    }
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  updateReservation(id: string, updates: Partial<ReservedArea>): ReservedArea | undefined {
    const existing = this.reservations.get(id);
    if (!existing) return undefined;
    
    const updated: ReservedArea = {
      ...existing,
      ...updates,
      id: existing.id,
    };
    this.reservations.set(id, updated);
    return updated;
  }

  deleteReservation(id: string): boolean {
    return this.reservations.delete(id);
  }

  deleteReservationsByUserId(userId: string): number {
    const userReservations = this.getReservationsByUserId(userId);
    let deleted = 0;
    for (const reservation of userReservations) {
      if (this.reservations.delete(reservation.id)) {
        deleted++;
      }
    }
    return deleted;
  }

  // Check if a textbox is inside any hidden reserved area (not owned by the querying user)
  isTextBoxHiddenFromUser(textbox: TextBox, viewerUserId: string): boolean {
    for (const reservation of this.reservations.values()) {
      // Skip if viewer owns the reservation
      if (reservation.userId === viewerUserId) continue;
      // Skip if not hidden
      if (!reservation.isHidden) continue;
      // Skip if textbox is owned by the reservation owner (they can see their own boxes)
      if (textbox.userId === reservation.userId) continue;
      
      // Check if textbox is inside this hidden reservation
      if (
        textbox.positionX >= reservation.x &&
        textbox.positionX <= reservation.x + reservation.width &&
        textbox.positionY >= reservation.y &&
        textbox.positionY <= reservation.y + reservation.height
      ) {
        return true;
      }
    }
    return false;
  }

  // Get visible textboxes for a specific user
  getVisibleTextBoxesForUser(userId: string): TextBox[] {
    return this.getAllTextBoxes().filter(tb => !this.isTextBoxHiddenFromUser(tb, userId));
  }

  // Utility
  clear(): void {
    this.textboxCache.clear();
    this.users.clear();
    this.cursors.clear();
    this.reservations.clear();
  }
}

// Singleton instance
export const store = new Store();
