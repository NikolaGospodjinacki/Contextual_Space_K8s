import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { getNextColor } from '../utils/colors';
import {
  TextBox,
  User,
  ReservedArea,
  CreateTextBoxPayload,
  UpdateTextBoxPayload,
  DeleteTextBoxPayload,
  CreateReservedAreaPayload,
  UpdateReservedAreaPayload,
  DeleteReservedAreaPayload,
  CursorMovePayload,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../types';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export async function setupSocketHandlers(io: TypedServer): Promise<void> {
  // Initialize the store cache from DynamoDB before handling connections
  await store.initializeCache();

  io.on('connection', (socket: TypedSocket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Handle user joining
    socket.on('user:join', (username: string) => {
      const userId = uuidv4();
      const color = getNextColor();

      const user: User = {
        id: userId,
        username: username || `User-${userId.slice(0, 4)}`,
        color,
        socketId: socket.id,
      };

      store.addUser(user);

      // Send initial state to the new user - all data, client filters
      socket.emit('sync:initial', {
        textboxes: store.getAllTextBoxes(),
        cursors: store.getAllCursors(),
        reservations: store.getAllReservations(),
      });

      // Broadcast new user to others
      socket.broadcast.emit('user:joined', {
        userId: user.id,
        username: user.username,
        color: user.color,
      });

      console.log(`[Socket] User joined: ${user.username} (${user.id})`);

      // Store user info on socket for disconnect handling
      (socket as any).userId = userId;
      (socket as any).username = username;
      (socket as any).userColor = color;
    });

    // Handle text box creation
    socket.on('textbox:create', async (payload: CreateTextBoxPayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', 'User not found. Please refresh the page.');
        return;
      }

      const textbox: TextBox = {
        id: uuidv4(),
        userId: user.id,
        username: user.username,
        content: payload.content,
        positionX: payload.positionX,
        positionY: payload.positionY,
        color: user.color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.createTextBox(textbox);

      // Broadcast to all - client-side will filter based on reservations
      io.emit('textbox:created', textbox);

      console.log(`[Socket] TextBox created: ${textbox.id} by ${user.username}`);
    });

    // Handle text box update
    socket.on('textbox:update', async (payload: UpdateTextBoxPayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', 'User not found. Please refresh the page.');
        return;
      }

      const textbox = store.getTextBox(payload.id);
      if (!textbox) {
        socket.emit('error', 'TextBox not found.');
        return;
      }

      // Only allow owner to edit (for now)
      if (textbox.userId !== user.id) {
        socket.emit('error', 'You can only edit your own text boxes.');
        return;
      }

      // Only include defined fields in the update
      const updates: Partial<typeof textbox> = {};
      if (payload.content !== undefined) updates.content = payload.content;
      if (payload.positionX !== undefined) updates.positionX = payload.positionX;
      if (payload.positionY !== undefined) updates.positionY = payload.positionY;

      const updated = await store.updateTextBox(payload.id, updates);

      if (updated) {
        // Broadcast to all - client-side will filter
        io.emit('textbox:updated', updated);
        console.log(`[Socket] TextBox updated: ${payload.id}`);
      }
    });

    // Handle text box deletion
    socket.on('textbox:delete', async (payload: DeleteTextBoxPayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', 'User not found. Please refresh the page.');
        return;
      }

      const textbox = store.getTextBox(payload.id);
      if (!textbox) {
        socket.emit('error', 'TextBox not found.');
        return;
      }

      // Only allow owner to delete
      if (textbox.userId !== user.id) {
        socket.emit('error', 'You can only delete your own text boxes.');
        return;
      }

      // Get the textbox before deleting to know who should see the deletion
      const deleted = await store.deleteTextBox(payload.id);
      if (deleted) {
        // Broadcast to all
        io.emit('textbox:deleted', payload.id);
        console.log(`[Socket] TextBox deleted: ${payload.id}`);
      }
    });

    // Handle clear all textboxes (dev feature)
    socket.on('textbox:clear-all', async () => {
      console.log(`[Socket] Clear all textboxes requested by ${socket.id}`);
      await store.clearAllTextBoxes();
      io.emit('textbox:cleared');
      console.log(`[Socket] All textboxes cleared`);
    });

    // Handle reservation creation
    socket.on('reservation:create', (payload: CreateReservedAreaPayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', 'User not found. Please refresh the page.');
        return;
      }

      const reservation: ReservedArea = {
        id: uuidv4(),
        userId: user.id,
        username: user.username,
        x: payload.x,
        y: payload.y,
        width: payload.width,
        height: payload.height,
        color: user.color,
        isHidden: false,
      };

      const created = store.createReservation(reservation);
      if (!created) {
        socket.emit('error', 'Cannot create area: it overlaps with an existing reserved area.');
        socket.emit('reservation:rejected', reservation.id);
        return;
      }
      
      io.emit('reservation:created', reservation);
      console.log(`[Socket] Reservation created: ${reservation.id} by ${user.username}`);
    });

    // Handle reservation update (toggle visibility)
    socket.on('reservation:update', (payload: UpdateReservedAreaPayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', 'User not found. Please refresh the page.');
        return;
      }

      const reservation = store.getReservation(payload.id);
      if (!reservation) {
        socket.emit('error', 'Reservation not found.');
        return;
      }

      if (reservation.userId !== user.id) {
        socket.emit('error', 'You can only modify your own reservation.');
        return;
      }

      const updated = store.updateReservation(payload.id, {
        isHidden: payload.isHidden,
      });

      if (updated) {
        io.emit('reservation:updated', updated);
        console.log(`[Socket] Reservation updated: ${payload.id}, hidden: ${updated.isHidden}`);
        // Client-side will handle filtering based on reservation visibility
      }
    });

    // Handle reservation deletion
    socket.on('reservation:delete', (payload: DeleteReservedAreaPayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) {
        socket.emit('error', 'User not found. Please refresh the page.');
        return;
      }

      const reservation = store.getReservation(payload.id);
      if (!reservation) {
        socket.emit('error', 'Reservation not found.');
        return;
      }

      if (reservation.userId !== user.id) {
        socket.emit('error', 'You can only delete your own reservation.');
        return;
      }

      store.deleteReservation(payload.id);
      io.emit('reservation:deleted', payload.id);
      console.log(`[Socket] Reservation deleted: ${payload.id}`);
      // Client-side will handle filtering
    });

    // Handle cursor movement
    socket.on('cursor:move', (payload: CursorMovePayload) => {
      const user = store.getUserBySocketId(socket.id);
      if (!user) return;

      const cursor = {
        userId: user.id,
        username: user.username,
        positionX: payload.positionX,
        positionY: payload.positionY,
        color: user.color,
      };

      store.updateCursor(cursor);

      // Broadcast cursor position to other clients
      socket.broadcast.emit('cursor:moved', cursor);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const user = store.removeUserBySocketId(socket.id);

      if (user) {
        // Clean up user's reservations (all of them)
        const userReservations = store.getReservationsByUserId(user.id);
        for (const reservation of userReservations) {
          store.deleteReservation(reservation.id);
          io.emit('reservation:deleted', reservation.id);
        }
        
        io.emit('user:left', user.id);
        io.emit('cursor:left', user.id);
        console.log(`[Socket] User disconnected: ${user.username} (${user.id})`);
      } else {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      }
    });
  });
}
