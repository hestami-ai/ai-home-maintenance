import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { useSession } from 'next-auth/react';

interface Message {
  id: string;
  role: 'client' | 'agent';
  content: string;
  timestamp: string;
}

interface ChatWindowProps {
  serviceRequestId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  serviceRequestId,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { connect, disconnect, sendMessage, socket } = useWebSocket();
  const { data: session } = useSession();

  useEffect(() => {
    // Only connect if we have both serviceRequestId and accessToken
    if (isOpen && serviceRequestId && session?.user?.accessToken) {
      connect(serviceRequestId, session.user.accessToken as string);
    } else {
      disconnect();
    }
    
    // Only disconnect when the component unmounts or chat is closed
    return () => {
      if (!isOpen) {
        disconnect();
      }
    };
  }, [isOpen, serviceRequestId, session?.user?.accessToken, connect, disconnect]);

  useEffect(() => {
    if (isOpen) {
      connect(serviceRequestId, session?.user?.accessToken as string);
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [isOpen, connect, disconnect, serviceRequestId, session?.user?.accessToken]);

  useEffect(() => {
    if (socket) {
      const handleMessageReceived = (_e: MessageEvent) => {
        try {
          const data = JSON.parse(_e.data);
          if (data.type === 'message') {
            setMessages(prev => [...prev, data.message]);
          }
        } catch {
          console.error('Failed to parse message');
        }
      };

      const handleSocketError = (_e: Event) => {
        setError('Connection error occurred');
        disconnect();
      };

      socket.onmessage = handleMessageReceived;
      socket.onerror = handleSocketError;

      return () => {
        socket.onmessage = null;
        socket.onerror = null;
      };
    }
  }, [socket, setMessages, setError, disconnect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    try {
      await sendMessage(inputValue);
      setInputValue('');
    } catch {
      console.error('Failed to send message');
    }
  };

  const handleKeyPress = async (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Chat with Client Liaison</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <span className="sr-only">Close chat</span>
          <svg
            className="h-6 w-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'client' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                message.role === 'client'
                  ? 'bg-primary-main text-white dark:bg-primary-dark'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-main dark:focus:ring-primary-light bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            onClick={handleSendMessage}
            className="px-4 py-2 bg-primary-main hover:bg-primary-dark text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-main dark:focus:ring-primary-light"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
