import React, { useState, useEffect } from 'react';
import { getProcessLogs, logProcessData, initializeRealTimeUpdates, subscribeToUpdates } from '../utils/processDataLogger';
import { API_KEYS, AI_CONFIG } from '../config/secrets';
import GeminiChat from './GeminiChat';

const AIChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelStatus, setModelStatus] = useState('checking');
  const [showRawPrompt, setShowRawPrompt] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [processLogs, setProcessLogs] = useState('');
  const [selectedModel, setSelectedModel] = useState('chrome');

  // Update session validity check function to be less strict
  const isSessionValid = async (currentSession) => {
    if (!currentSession) return false;
    try {
      // Just check if the session object exists and has the required methods
      return typeof currentSession.prompt === 'function';
    } catch (err) {
      console.log('Session validation failed:', err);
      return false;
    }
  };

  // Update checkAvailability with minimal configuration
  const checkAvailability = async () => {
    try {
      if (!chrome.runtime.id || !chrome.aiOriginTrial?.languageModel) {
        throw new Error('AI Language Model API not available');
      }

      const caps = await chrome.aiOriginTrial.languageModel.capabilities();
      console.log('AI capabilities:', caps);
      
      if (caps?.available === 'readily') {
        setModelStatus('ready');
        
        const newSession = await chrome.aiOriginTrial.languageModel.create({
          systemPrompt: 'You analyze Chrome processes. Answer in 5 words.',  // Extremely simple system prompt
          temperature: 0.1,  // Very low temperature for consistent responses
          topK: 1,
          maxOutputTokens: 10
        });

        if (!newSession) {
          throw new Error('Session creation failed');
        }

        setSession(newSession);
        setError(null);
      } else {
        setModelStatus('unavailable');
        throw new Error('AI model is not available');
      }
    } catch (err) {
      console.error('AI availability check error:', err);
      setError(err.message);
      setModelStatus('error');
    }
  };

  // Update handleSubmit with extremely simplified prompt
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !session) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: input }]);

    try {
      // Get only essential process data
      const processes = await chrome.processes.getProcessInfo([], true);
      const highCPUProcesses = Object.values(processes)
        .filter(p => p.cpu > 5)  // Only processes using >5% CPU
        .map(p => `${p.tasks?.[0]?.title || 'unnamed'}: ${p.cpu.toFixed(1)}% CPU`)
        .slice(0, 3)  // Only top 3 processes
        .join(', ');

      // Create a very simple prompt
      const prompt = `High CPU processes: ${highCPUProcesses || 'None'}. ${input}`;
      console.log('Sending prompt:', prompt);  // Debug log

      try {
        const response = await session.prompt(prompt);
        console.log('Got response:', response);  // Debug log
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        setInput('');
        setError(null);
      } catch (promptError) {
        console.error('Prompt error:', promptError);
        // Try one more time with even simpler prompt
        const retryPrompt = input.slice(0, 50);  // Limit input length
        const response = await session.prompt(retryPrompt);
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        setInput('');
        setError(null);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError('Model error. Please reload the extension.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove the real-time updates and keep only initial load
  useEffect(() => {
    const initializeAI = async () => {
      try {
        await checkAvailability();
        const logs = await getProcessLogs();
        if (logs) {
          setProcessLogs(logs);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    initializeAI();
  }, []);

  // Update estimateTokens to match new system prompt
  const estimateTokens = (text, currentLogs = processLogs) => {
    if (!text && !currentLogs) return 0;
    const systemPrompt = `You are a helpful assistant analyzing Chrome browser performance.
Your role is to analyze process data and provide insights.
Always answer in 5 words or less.
Be direct and specific in your responses.
Process Logs: ${currentLogs}`;
    const totalText = systemPrompt + '\nUser: ' + text;
    return Math.ceil(totalText.length / 4);
  };

  const handleInputChange = (e) => {
    const newInput = e.target.value;
    setInput(newInput);
    setTokenCount(estimateTokens(newInput));
  };

  const getStatusBadge = () => {
    const badges = {
      checking: { color: 'bg-yellow-100 text-yellow-800', text: 'Checking Availability' },
      ready: { color: 'bg-green-100 text-green-800', text: 'Model Ready' },
      downloading: { color: 'bg-blue-100 text-blue-800', text: 'Downloading Model' },
      unavailable: { color: 'bg-red-100 text-red-800', text: 'Model Unavailable' },
      error: { color: 'bg-red-100 text-red-800', text: 'Error' },
    };
    const badge = badges[modelStatus];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  // Update getRawPrompt to show only memory data
  const getRawPrompt = () => {
    const prompt = `System: You analyze Chrome memory usage.
Always answer in 5 words or less.
Be direct and specific.

${processLogs ? 'Memory Usage:\n' + processLogs : 'No memory data available'}

User Question: ${input}

Analyze memory usage and answer the question.`;
    
    return prompt;
  };

  // Add model selector component
  const ModelSelector = () => (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-gray-600">Model:</span>
      <select
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        className="px-2 py-1 border rounded text-sm"
        disabled={isLoading}
      >
        <option value="chrome">Gemini Nano</option>
        <option value="gemini">Gemini Flash</option>
      </select>
    </div>
  );

  // Update the return statement to include model selection
  return (
    <div className="flex flex-col h-full min-h-[600px]">
      <div className="flex justify-between items-center mb-4 p-4 bg-white border-b">
        <h2 className="text-xl font-semibold">AI Assistant</h2>
        <div className="flex items-center gap-4">
          <ModelSelector />
          <div className="flex items-center gap-2">
            {selectedModel === 'chrome' && (
              <button
                onClick={checkAvailability}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                Restart Session
              </button>
            )}
            {selectedModel === 'chrome' && getStatusBadge()}
          </div>
        </div>
      </div>

      {/* Render appropriate chat interface based on selected model */}
      {selectedModel === 'chrome' ? (
        // Original Chrome AI chat interface
        <>
          {/* Messages */}
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

          {/* Raw prompt display with process logs */}
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

          {/* Error display */}
          {error && (
            <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Input area */}
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
                onChange={handleInputChange}
                placeholder="Type your message..."
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
                disabled={isLoading || modelStatus !== 'ready'}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                {tokenCount} tokens
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || modelStatus !== 'ready' || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              Send
            </button>
          </form>
        </>
      ) : (
        <GeminiChat />
      )}
    </div>
  );
};

export default AIChat; 