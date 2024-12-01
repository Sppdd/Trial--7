import React, { useState, useEffect } from 'react';
import { getProcessLogs, logProcessData, initializeRealTimeUpdates, subscribeToUpdates } from '../utils/processDataLogger';
import { API_KEYS, AI_CONFIG } from '../config/secrets';

const GeminiChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processLogs, setProcessLogs] = useState('');
  const [showRawPrompt, setShowRawPrompt] = useState(false);

  useEffect(() => {
    const initializeLogs = async () => {
      try {
        const logs = await getProcessLogs();
        if (logs) {
          setProcessLogs(logs);
        }
      } catch (err) {
        console.error('Error initializing logs:', err);
      }
    };

    initializeLogs();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToUpdates((newLogs) => {
      setProcessLogs(newLogs);
      console.log('Gemini received new logs:', newLogs);
    });

    const cleanup = initializeRealTimeUpdates();

    return () => {
      unsubscribe();
      cleanup();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: input }]);

    try {
      const processes = await chrome.processes.getProcessInfo([], true);
      const latestLogs = await logProcessData(processes);
      
      if (latestLogs) {
        setProcessLogs(latestLogs);
      }
      
      const prompt = {
        contents: [{
          parts: [{
            text: `You are a helpful assistant analyzing Chrome browser performance.
                   Your role is to analyze process data and provide insights.
                   Always answer in 5 words or less.
                   Be direct and specific in your responses.

                   Current Process Data:
                   ${processLogs || 'No process data available'}

                   User Question: ${input}

                   Analyze the above process data and answer the question.`
          }]
        }]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${AI_CONFIG.MODELS.GEMINI_FLASH}:generateContent?key=${API_KEYS.GEMINI_API_KEY}`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(prompt)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const answer = data.candidates[0].content.parts[0].text;
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      setInput('');
      setError(null);
    } catch (err) {
      console.error('Gemini chat error:', err);
      setError(`Failed to get response: ${err.message}`);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Failed to analyze. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getRawPrompt = () => {
    const prompt = `System: You are a helpful assistant analyzing Chrome browser performance.
Your role is to analyze process data and provide insights.
Always answer in 5 words or less.
Be direct and specific in your responses.

Current Process Data:
${processLogs || 'No process data available'}

User Question: ${input}

Analyze the above process data and answer the question.`;
    
    return prompt;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto mb-4 space-y-4 p-4 border rounded-lg">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-blue-50 ml-auto max-w-[80%]' 
                : 'bg-gray-50 mr-auto max-w-[80%]'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="bg-gray-50 p-3 rounded-lg mr-auto">
            <p className="text-sm">Thinking...</p>
          </div>
        )}
      </div>

      {showRawPrompt && (
        <div className="mx-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">Raw Prompt</span>
            <span className="text-xs text-gray-500">
              Last Updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
          <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap">
            {getRawPrompt()}
          </pre>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4">
        <button
          type="button"
          onClick={() => setShowRawPrompt(!showRawPrompt)}
          className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
        >
          {showRawPrompt ? 'Hide Raw' : 'Show Raw'}
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default GeminiChat; 