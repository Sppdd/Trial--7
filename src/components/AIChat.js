import React, { useState, useEffect } from 'react';
import { getProcessLogs, logProcessData } from '../utils/processDataLogger';

const AIChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelStatus, setModelStatus] = useState('checking');
  const [temperature, setTemperature] = useState(1.0);
  const [topK, setTopK] = useState(3);
  const [showRawPrompt, setShowRawPrompt] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [processLogs, setProcessLogs] = useState('');

  // Add session validity check function
  const isSessionValid = async (currentSession) => {
    if (!currentSession || !currentSession.prompt) return false;
    try {
      // Try a simple test prompt to verify session
      await currentSession.prompt('test', { silent: true });
      return true;
    } catch (err) {
      console.log('Session validation failed:', err);
      return false;
    }
  };

  // Update checkAvailability with simpler system prompt
  const checkAvailability = async () => {
    try {
      if (!chrome.aiOriginTrial?.languageModel) {
        throw new Error('AI Language Model API not available');
      }

      const caps = await chrome.aiOriginTrial.languageModel.capabilities();
      console.log('AI capabilities:', caps);
      
      if (caps?.available === 'readily') {
        setModelStatus('ready');
        
        // Create new session with simplified system prompt
        const newSession = await chrome.aiOriginTrial.languageModel.create({
          systemPrompt: `You are a helpful assistant analyzing Chrome browser performance.
            Your role is to analyze process data and provide insights.
            Always answer in 5 words or less.
            Be direct and specific in your responses.`,
          temperature: temperature,
          topK: topK,
          maxOutputTokens: 10,
          timeoutSeconds: 30,
        });

        // Validate new session before setting
        if (await isSessionValid(newSession)) {
          setSession(newSession);
          setError(null);
        } else {
          throw new Error('Failed to create valid session');
        }
      } else if (caps?.available === 'after-download') {
        setModelStatus('downloading');
        setError('Model needs to be downloaded first. This may take a moment.');
        const downloadSession = await chrome.aiOriginTrial.languageModel.create({
          systemPrompt: 'You are a helpful assistant. Always answer in 5 words or less.',
          temperature: temperature,
          topK: topK,
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              const progress = Math.round((e.loaded / e.total) * 100);
              setError(`Downloading model: ${progress}%`);
              if (progress === 100) {
                setModelStatus('ready');
                setError(null);
              }
            });
          },
        });
        setSession(downloadSession);
      } else {
        setModelStatus('unavailable');
        throw new Error('AI model is not available');
      }
    } catch (err) {
      console.error('AI availability check error:', err);
      setError(err.message || 'Error checking AI availability');
      setModelStatus('error');
    }
  };

  // Add session refresh interval
  useEffect(() => {
    checkAvailability();
    
    // Refresh session every 15 minutes to prevent expiration
    const refreshInterval = setInterval(async () => {
      console.log('Checking session validity...');
      if (session && !(await isSessionValid(session))) {
        console.log('Session expired, refreshing...');
        await checkAvailability();
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      clearInterval(refreshInterval);
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy();
        } catch (err) {
          console.error('Error destroying session:', err);
        }
      }
    };
  }, []);

  // Update handleSubmit to include process data with user input
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Validate session before use
    if (!(await isSessionValid(session))) {
      console.log('Session invalid, recreating...');
      await checkAvailability();
      if (!session) {
        setError('Unable to create AI session. Please try again.');
        return;
      }
    }

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: input }]);

    try {
      // Get fresh process data
      const processes = await chrome.processes.getProcessInfo([], true);
      const latestLogs = await logProcessData(processes);
      
      // Combine user input with process data
      const fullPrompt = `Current Process Data:
${latestLogs || 'No process data available'}

User Question: ${input}

Analyze the above process data and answer the question.`;

      // Attempt prompt with validation
      const response = await session.prompt(fullPrompt);
      console.log('Response:', response);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setInput('');
      setError(null);
    } catch (err) {
      console.error('Chat error:', err);
      if (err instanceof DOMException || err.message.includes('session')) {
        await checkAvailability();
        setError('Session expired. Please try again.');
      } else {
        setError(`Failed to get response: ${err.message}`);
      }
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Failed to analyze. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

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

  // Update getRawPrompt to match new format
  const getRawPrompt = () => {
    const prompt = `System: You are a helpful assistant analyzing Chrome browser performance.
Your role is to analyze process data and provide insights.
Always answer in 5 words or less.
Be direct and specific in your responses.

Current Process Data:
${processLogs || 'Waiting for process data...'}

User Question: ${input}

Analyze the above process data and answer the question.`;
    
    console.log('Raw prompt:', prompt);
    return prompt;
  };

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-4 bg-white border-b">
        <h2 className="text-xl font-semibold">AI Assistant</h2>
        <div className="flex items-center gap-4">
          <div className="flex flex-col w-32">
            <label className="text-sm text-gray-600">Temperature</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 mt-1">{temperature}</span>
          </div>
          <div className="flex flex-col w-32">
            <label className="text-sm text-gray-600">Top-K</label>
            <input
              type="range"
              min="1"
              max="8"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 mt-1">{topK}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkAvailability}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Restart Session
            </button>
            {getStatusBadge()}
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default AIChat; 