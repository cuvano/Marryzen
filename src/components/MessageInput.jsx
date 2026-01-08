import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const MessageInput = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-white p-3 rounded-full border border-slate-200 shadow-sm">
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-slate-400 hover:text-purple-600 rounded-full"
        onClick={() => toast({ title: "😊 Emojis coming soon!" })}
        disabled={disabled}
      >
        <Smile className="w-5 h-5" />
      </Button>
      
      <Input 
        value={message} 
        onChange={(e) => setMessage(e.target.value)} 
        onKeyDown={handleKeyPress}
        placeholder="Type a respectful message..." 
        className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent px-2"
        disabled={disabled}
      />
      
      <Button 
        onClick={handleSend} 
        disabled={!message.trim() || disabled} 
        className="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-10 h-10 p-0 flex items-center justify-center shrink-0 transition-all"
      >
        <Send className="w-4 h-4 ml-0.5" />
      </Button>
    </div>
  );
};

export default MessageInput;