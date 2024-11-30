import React, { useState, useEffect } from 'react';
import { Activity, XCircle, RefreshCw, HardDrive, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Alert, AlertTitle, AlertDescription } from './componenets/ui/alert';


const ProcessManager = () => {
  const [processes, setProcesses] = useState({});
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [memoryHistory, setMemoryHistory] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [sortBy, setSortBy] = useState('cpu');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    const updateProcesses = async () => {
      try {
        const info = await chrome.processes.getProcessInfo([], true);
        setProcesses(info);
      } catch (err) {
        setError(err.message);
      }
    };

    // Initial load
    updateProcesses();

    // Set up listeners for process updates
    chrome.processes.onUpdatedWithMemory.addListener((updatedProcesses) => {
      setProcesses(updatedProcesses);
      
      if (selectedProcess) {
        const process = updatedProcesses[selectedProcess];
        if (process) {
          // Update history for charts
          const timestamp = new Date().toLocaleTimeString();
          
          setCpuHistory(prev => [...prev.slice(-20), {
            time: timestamp,
            cpu: process.cpu || 0
          }]);
          
          setMemoryHistory(prev => [...prev.slice(-20), {
            time: timestamp,
            memory: process.privateMemory ? process.privateMemory / (1024 * 1024) : 0
          }]);
        }
      }
    });

    chrome.processes.onExited.addListener((processId) => {
      if (selectedProcess === processId) {
        setSelectedProcess(null);
      }
    });

    return () => {
      chrome.processes.onUpdatedWithMemory.removeListener();
      chrome.processes.onExited.removeListener();
    };
  }, [selectedProcess]);

  const terminateProcess = async (processId) => {
    try {
      const success = await chrome.processes.terminate(processId);
      if (!success) {
        setError('Failed to terminate process');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const formatMemory = (bytes) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCacheSize = (process) => {
    if (!process.imageCache && !process.cssCache && !process.scriptCache) {
      return 'N/A';
    }
    
    const total = (process.imageCache?.liveSize || 0) + 
                  (process.cssCache?.liveSize || 0) + 
                  (process.scriptCache?.liveSize || 0);
                  
    return formatMemory(total);
  };

  const getProcessTypeIcon = (type) => {
    switch (type) {
      case 'browser': return <Activity className="w-5 h-5" />;
      case 'renderer': return <Cpu className="w-5 h-5" />;
      case 'gpu': return <HardDrive className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const groupProcesses = (processes) => {
    if (groupBy === 'none') return processes;
    
    return Object.entries(processes).reduce((groups, [id, process]) => {
      const key = groupBy === 'type' ? process.type : 'other';
      if (!groups[key]) groups[key] = {};
      groups[key][id] = process;
      return groups;
    }, {});
  };

  const sortProcesses = (processes) => {
    return Object.entries(processes).sort(([, a], [, b]) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });
  };

  const filterProcesses = (processes) => {
    if (!filter) return processes;
    
    return Object.entries(processes).reduce((filtered, [id, process]) => {
      if (
        process.type.toLowerCase().includes(filter.toLowerCase()) ||
        id.toString().includes(filter)
      ) {
        filtered[id] = process;
      }
      return filtered;
    }, {});
  };

  const getProcessName = (process) => {
    // Special handling for utility processes
    if (process.type === 'utility') {
      if (process.title?.includes('Network')) return 'Utility: Network Service';
      if (process.title?.includes('Storage')) return 'Utility: Storage Service';
      if (process.title?.includes('Device')) return 'Utility: On-Device Model Service';
      return `Utility: ${process.title || 'Unknown'}`;
    }

    // Special handling for extensions and tabs
    if (process.type === 'renderer') {
      if (process.title?.includes('Extension:')) {
        return process.title;
      }
      if (process.title) {
        return `Tab: ${process.title}`;
      }
      return 'Tab';
    }

    // Handle other process types
    switch (process.type) {
      case 'browser':
        return 'Browser';
      case 'gpu':
        return 'GPU Process';
      case 'extension':
        return `Extension: ${process.title || 'Unknown'}`;
      case 'plugin':
        return `Plugin: ${process.title || 'Unknown'}`;
      case 'spare_renderer':
        return 'Spare renderer';
      default:
        return process.title || process.type || 'Unknown Process';
    }
  };

  // Add this debug function
  const debugProcess = (process) => {
    console.log('Process:', {
      id: process.id,
      type: process.type,
      title: process.title,
      profile: process.profile,
      tasks: process.tasks
    });
  };

  // Add window resize handling
  useEffect(() => {
    const handleResize = () => {
      // Force a re-render on window resize
      setProcesses(prev => ({...prev}));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update the main container styles
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1400px] mx-auto bg-white rounded-lg shadow-lg">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-1 min-h-[600px]">
          {/* Left side - Process List */}
          <div className={`${selectedProcess ? 'w-2/3' : 'w-full'} transition-all duration-200`}>
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Chrome Processes</h2>
              </div>
              <div className="overflow-auto max-h-[calc(100vh-180px)]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memory footprint ▼</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Process ID</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(processes).map(([id, process]) => (
                      <tr 
                        key={id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedProcess === parseInt(id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedProcess(parseInt(id))}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getProcessTypeIcon(process.type)}
                            <span className="ml-3 text-sm text-gray-900">{getProcessName(process)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatMemory(process.privateMemory)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {process.cpu ? `${process.cpu.toFixed(1)}` : '0.0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {process.network ? process.network.toFixed(1) : '0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {process.osProcessId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right side - Process Details */}
          {selectedProcess !== null && processes[selectedProcess] && (
            <div className="w-1/3 transition-all duration-200">
              <div className="bg-white shadow-lg rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Process Details</h3>
                
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Process Information</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-500">Type:</span>
                        <div className="flex items-center mt-1">
                          {getProcessTypeIcon(processes[selectedProcess].type)}
                          <span className="ml-2 text-sm text-gray-900">{processes[selectedProcess].type}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Process ID:</span>
                        <p className="mt-1 text-sm text-gray-900">{processes[selectedProcess].osProcessId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Memory Metrics */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Memory Usage</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-500">Private Memory:</span>
                        <p className="mt-1 text-sm text-gray-900">{formatMemory(processes[selectedProcess].privateMemory)}</p>
                      </div>
                      {/* Add other memory metrics here */}
                    </div>
                  </div>

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
                        <span className="text-sm text-gray-500">Network Activity:</span>
                        <p className="mt-1 text-sm text-gray-900">
                          {processes[selectedProcess].network ? `${processes[selectedProcess].network.toFixed(1)} KB/s` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessManager;