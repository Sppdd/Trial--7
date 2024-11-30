import React from 'react';
import ProcessManager from './components/ProcessManager';
import AIChat from './components/AIChat';

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Chrome Task Manager & Assistant</h1>
        
        <div className="flex flex-col gap-6">
          {/* AI Chat Section - Full Width */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <AIChat />
          </div>

          {/* Process Manager Section - Full Width */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Process Manager</h2>
            <ProcessManager />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 