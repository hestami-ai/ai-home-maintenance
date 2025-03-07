import { create } from 'zustand';

// Using a logger instead of console for better production handling
const logger = {
  log: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

interface WebSocketStore {
  socket: WebSocket | null;
  isConnected: boolean;
  connect: (serviceRequestId: string, token: string) => void;
  disconnect: () => void;
  sendMessage: (message: string) => void;
  reconnectAttempts: number;
}

export const useWebSocket = create<WebSocketStore>((set, get) => ({
  socket: null,
  isConnected: false,
  reconnectAttempts: 0,

  connect: (serviceRequestId: string, token: string): void => {
    const { socket: existingSocket } = get();
    
    // If there's an existing connection to the same service request, don't reconnect
    if (existingSocket?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing socket if any
    if (existingSocket) {
      existingSocket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(
      `${protocol}//${process.env.NEXT_PUBLIC_AGENTS_WS}/api/v1/agent-chat/ws/${serviceRequestId}?token=${token}`
    );

    socket.onopen = (): void => {
      set({ isConnected: true, reconnectAttempts: 0 });
      logger.log('WebSocket connected');
      // Send initial message to trigger agent greeting
      socket.send(JSON.stringify({
        role: 'client',
        content: encodeURIComponent('Hello')
      }));
    };

    socket.onmessage = (event: MessageEvent): void => {
      logger.log('WebSocket message received:', event.data);
    };

    socket.onclose = (event: CloseEvent): void => {
      const { reconnectAttempts } = get();
      logger.log('WebSocket disconnected:', event.reason);
      
      set({ isConnected: false });

      // Handle unauthorized access
      if (event.code === 4003) {
        logger.error('Unauthorized access to service request');
        set({ socket: null });
        return;
      }

      // Attempt to reconnect if not explicitly disconnected
      if (reconnectAttempts < 3) {
        logger.log(`Attempting to reconnect (${reconnectAttempts + 1}/3)...`);
        setTimeout(() => {
          set({ reconnectAttempts: reconnectAttempts + 1 });
          get().connect(serviceRequestId, token);
        }, 1000 * Math.pow(2, reconnectAttempts)); // Exponential backoff
      } else {
        set({ socket: null });
        logger.error('Max reconnection attempts reached');
      }
    };

    socket.onerror = (error: Event): void => {
      logger.error('WebSocket error:', error);
    };

    set({ socket });
  },

  disconnect: (): void => {
    const { socket } = get();
    if (socket) {
      // Set reconnectAttempts to max to prevent auto-reconnection
      set({ reconnectAttempts: 3 });
      socket.close();
      set({ socket: null, isConnected: false });
    }
  },

  sendMessage: (message: string): void => {
    const { socket, isConnected } = get();
    if (socket && isConnected) {
      socket.send(JSON.stringify({
        role: 'client',
        content: encodeURIComponent(message)
      }));
    } else {
      logger.error('WebSocket is not connected');
    }
  },
}));
