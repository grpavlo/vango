import { useState } from 'react';
import { Send, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  isSent: boolean;
  status: 'sent' | 'delivered' | 'read';
}

interface DispatchChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const DispatchChat = ({ isOpen, onClose }: DispatchChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! How can we assist you today?',
      timestamp: new Date(Date.now() - 300000),
      isSent: false,
      status: 'read'
    }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        text: newMessage.trim(),
        timestamp: new Date(),
        isSent: true,
        status: 'sent'
      };
      setMessages(prev => [...prev, message]);
      setNewMessage('');

      // Simulate delivery status updates
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, status: 'delivered' } : msg
        ));
      }, 1000);

      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, status: 'read' } : msg
        ));
      }, 2000);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white hover:text-white/70">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="font-semibold">Dispatch Center</h1>
          <p className="text-xs text-white/80">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isSent ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] ${message.isSent ? 'ml-4' : 'mr-4'}`}>
              <div
                className={`p-3 rounded-lg ${
                  message.isSent
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white/10 text-white rounded-bl-sm'
                }`}
              >
                <p className="text-sm">{message.text}</p>
              </div>
              <div className={`flex items-center gap-1 mt-1 ${message.isSent ? 'justify-end' : 'justify-start'}`}>
                <span className="text-xs text-white/60">{formatTime(message.timestamp)}</span>
                {message.isSent && (
                  <div className="text-white/60">
                    {message.status === 'sent' && <Check size={12} />}
                    {message.status === 'delivered' && <CheckCheck size={12} />}
                    {message.status === 'read' && <CheckCheck size={12} className="text-primary" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-background p-4 border-t border-white/20">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60"
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DispatchChat;