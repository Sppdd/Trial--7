import React, { useState, useEffect } from 'react';
import { Activity, XCircle, RefreshCw, HardDrive, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { logProcessData, getProcessLogs } from '../utils/processDataLogger';

const ProcessManager = () => {
  const [processes, setProcesses] = useState({});
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [error, setError] = useState(null);
  const [isLogging, setIsLogging] = useState(false);
  const [lastLogTime, setLastLogTime] = useState(null);
  
  // Process details helper
  const getProcessDetails = (process) => {
    const details = {
      name: 'Unknown',
      subtasks: []
    };

    // First set the name based on process type
    switch (process.type) {
      case 'browser':
        details.name = 'Browser Process';
        break;
      case 'renderer':
        details.name = 'Renderer Process';
        break;
      case 'extension':
        details.name = 'Extension Process';
        break;
      case 'notification':
        details.name = 'Notification Process';
        break;
      case 'plugin':
        details.name = 'Plugin Process';
        break;
      case 'worker':
        details.name = 'Worker Process';
        break;
      case 'service_worker':
        details.name = 'Service Worker Process';
        break;
      case 'utility':
        details.name = 'Utility Process';
        break;
      case 'gpu':
        details.name = 'GPU Process';
        break;
      case 'other':
        details.name = 'Other Process';
        break;
      default:
        details.name = `${process.type} Process`;
    }

    // Add task details as subtasks
    if (process.tasks) {
      details.subtasks = process.tasks
        .filter(t => t.title)
        .map(t => ({
          id: t.taskId || Math.random(),
          name: t.title
        }));
    }

    return details;
  };

  // CPU usage formatter
  const formatCpuUsage = (process) => {
    if (!process || typeof process.cpu === 'undefined') return '0%';
    return `${(process.cpu).toFixed(1)}%`;
  };

  // Real-time process updates
  useEffect(() => {
    const handleProcessUpdate = (updatedProcesses) => {
      console.log('Process update received:', updatedProcesses);
      setProcesses(updatedProcesses);
    };

    const handleProcessExit = (processId) => {
      if (selectedProcess === parseInt(processId)) {
        setSelectedProcess(null);
      }
      setProcesses(prev => {
        const updated = { ...prev };
        delete updated[processId];
        return updated;
      });
    };

    // Initialize processes
    const initializeProcesses = async () => {
      try {
        // Get all processes with memory info
        const processInfo = await chrome.processes.getProcessInfo([], true);
        setProcesses(processInfo);
      } catch (err) {
        console.error('Error getting process info:', err);
        setError(err.message);
      }
    };

    // Set up real-time updates
    chrome.processes.onUpdatedWithMemory.addListener(handleProcessUpdate);
    chrome.processes.onExited.addListener(handleProcessExit);
    
    // Initial load
    initializeProcesses();

    return () => {
      chrome.processes.onUpdatedWithMemory.removeListener(handleProcessUpdate);
      chrome.processes.onExited.removeListener(handleProcessExit);
    };
  }, []); // Remove selectedProcess dependency

  const terminateProcess = async (processId) => {
    try {
      await chrome.processes.terminate(processId);
    } catch (err) {
      setError(err.message);
    }
  };

  // Process type icon helper
  const getProcessTypeIcon = (type) => {
    switch (type) {
      case 'browser': return <Activity className="w-4 h-4 text-blue-600" />;
      case 'renderer': return <HardDrive className="w-4 h-4 text-green-600" />;
      case 'gpu': return <Cpu className="w-4 h-4 text-purple-600" />;
      default: return <RefreshCw className="w-4 h-4 text-gray-600" />;
    }
  };

  // Process logging logic
  useEffect(() => {
    let loggingInterval;
    
    const startLogging = () => {
      loggingInterval = setInterval(async () => {
        if (Object.keys(processes).length > 0) {
          const success = await logProcessData(processes);
          if (success) {
            setLastLogTime(new Date().toLocaleTimeString());
          }
        }
      }, 10000); // Log every 10 seconds
    };

    // Start logging when component mounts
    startLogging();
    setIsLogging(true);

    // Cleanup interval on unmount
    return () => {
      if (loggingInterval) {
        clearInterval(loggingInterval);
      }
    };
  }, [processes]);

  // Add data purge every 2 minutes
  useEffect(() => {
    const purgeInterval = setInterval(async () => {
      const logs = await getProcessLogs();
      if (logs) {
        const lines = logs.split('\n');
        if (lines.length > 13) { // header + 12 entries
          const newLogs = [lines[0], ...lines.slice(-12)].join('\n');
          await chrome.storage.local.set({ processLogs: newLogs });
        }
      }
    }, 120000); // Check every 2 minutes

    return () => clearInterval(purgeInterval);
  }, []);

  // Add logging status display to the UI
  const renderLoggingStatus = () => (
    <div className="text-xs text-gray-500 mt-2">
      {isLogging ? (
        <span>Last logged: {lastLogTime || 'Never'}</span>
      ) : (
        <span>Logging inactive</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-1 min-h-[600px]">
        {/* Left side - Process List */}
        <div className={`${selectedProcess ? 'w-2/3' : 'w-full'} transition-all duration-200`}>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Process Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name & Subtasks
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Memory
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPU
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Network
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Process ID
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(processes).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                        No processes found or waiting for data...
                      </td>
                    </tr>
                  ) : (
                    Object.entries(processes).map(([id, process]) => {
                      console.log('Rendering process:', id, process);
                      const details = getProcessDetails(process);
                      return (
                        <tr
                          key={id}
                          onClick={() => setSelectedProcess(parseInt(id))}
                          className={`hover:bg-gray-50 cursor-pointer ${
                            selectedProcess === parseInt(id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getProcessTypeIcon(process.type)}
                              <span className="ml-2 text-sm text-gray-900">
                                {process.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 font-medium">
                              {details.name}
                            </div>
                            {details.subtasks.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {details.subtasks.map(subtask => (
                                  <div key={subtask.id} className="text-xs text-gray-500 pl-4">
                                    └─ {subtask.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {process.privateMemory ? (process.privateMemory / (1024 * 1024)).toFixed(1) + ' MB' : '0 MB'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCpuUsage(process)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {process.network ? process.network.toFixed(1) + ' KB/s' : '0 KB/s'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {process.osProcessId}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right side - Process Details */}
        {selectedProcess && processes[selectedProcess] && (
          <div className="w-1/3 pl-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Process Details</h3>
              
              {/* Performance Metrics */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Performance</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">CPU Usage:</span>
                    <p className="mt-1 text-sm text-gray-900">
                      {processes[selectedProcess].cpu ? `${processes[selectedProcess].cpu.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Memory Usage:</span>
                    <p className="mt-1 text-sm text-gray-900">
                      {processes[selectedProcess].privateMemory 
                        ? `${(processes[selectedProcess].privateMemory / (1024 * 1024)).toFixed(1)} MB` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Network Activity:</span>
                    <p className="mt-1 text-sm text-gray-900">
                      {processes[selectedProcess].network ? `${processes[selectedProcess].network.toFixed(1)} KB/s` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => terminateProcess(selectedProcess)}
                className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                End Process
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessManager; 