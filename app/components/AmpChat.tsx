'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AmpChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/amp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage.content }],
        }),
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        if (reader) {
          let assistantContent = '';
          const assistantMessage: Message = {
            role: 'assistant',
            content: '',
            timestamp: new Date(),
          };

          // Add the assistant message immediately
          setMessages(prev => [...prev, assistantMessage]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            assistantContent += chunk;

            // Update the last assistant message with streaming content
            setMessages(prev => 
              prev.map((msg, index) => 
                index === prev.length - 1 && msg.role === 'assistant'
                  ? { ...msg, content: assistantContent }
                  : msg
              )
            );
          }
        } else {
          // Non-streaming response
          const text = await response.text();
          const assistantMessage: Message = {
            role: 'assistant',
            content: text,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto border border-gray-700 rounded-lg bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <Bot className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">Amp Assistant</h2>
        <span className="text-xs text-gray-400 ml-auto">
          Context-aware AI for AgentVibes data
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[600px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-lg font-medium mb-2">Hello! I'm Amp</p>
            <p className="text-sm">
              I can help you analyze your AgentVibes dashboard data. Ask me about trends, sentiment, 
              specific tools, or anything else you'd like to know!
            </p>
            <div className="mt-4 text-xs text-gray-500">
              <p>Try asking:</p>
              <ul className="mt-2 space-y-1">
                <li>"What are the latest trends in AI coding assistants?"</li>
                <li>"Show me sentiment analysis for recent entries"</li>
                <li>"What tools are getting the most attention?"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`flex gap-3 max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gray-700'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div
                className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100 border border-gray-700'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
                <div
                  className={`text-xs mt-2 opacity-70 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div className="bg-gray-800 text-gray-100 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                  </div>
                  <span>Analyzing data...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything about your AgentVibes data... (⌘+Enter to send)"
            disabled={isLoading}
            rows={3}
            className="flex-1 resize-none bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          Amp can access your dashboard data including entries, sentiment analysis, and research papers
        </div>
      </div>
    </div>
  );
}
