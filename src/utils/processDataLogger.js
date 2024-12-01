/**
 * Process Data Logger Module
 * 
 * This module handles the logging and formatting of Chrome process data.
 * It captures system metrics like CPU usage, memory consumption, and network activity
 * for each Chrome process and stores them in a structured format.
 * 
 * Key Features:
 * - Formats process data with timestamps
 * - Stores single point of data in Chrome storage
 * - Provides data retrieval functionality
 * - Handles process metrics (CPU, Memory, Network)
 * - Real-time data updates
 */

// Store for subscribers wanting real-time updates
let subscribers = new Set();

// Subscribe to real-time updates
export const subscribeToUpdates = (callback) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback); // Return cleanup function
};

// Notify all subscribers of new data
const notifySubscribers = (data) => {
  subscribers.forEach(callback => callback(data));
};

// Formats raw process data into a tabulated string format
const formatProcessData = (processes) => {
  const timestamp = new Date().toISOString();
  let dataRows = [];

  Object.entries(processes).forEach(([id, process]) => {
    const cpu = process.cpu?.toFixed(1) || '0.0';          // CPU usage in percentage
    const memory = (process.privateMemory / (1024 * 1024)).toFixed(1) || '0.0';  // Memory in MB
    const network = process.network?.toFixed(1) || '0.0';   // Network usage in KB/s
    const type = process.type || 'unknown';                 // Process type
    const name = process.tasks?.[0]?.title || process.type || 'unnamed';  // Process name/title
    
    dataRows.push(
      `${timestamp}\t${id}\t${type}\t${name}\t${cpu}\t${memory}\t${network}`
    );
  });

  return dataRows.join('\n');
};

// Log process data and notify subscribers
export const logProcessData = async (processes) => {
  try {
    const header = 'Timestamp\tProcess ID\tType\tName\tCPU (%)\tMemory (MB)\tNetwork (KB/s)';
    const formattedData = formatProcessData(processes);
    
    // Store single point of data with header
    const logs = `${header}\n${formattedData}`;
    
    await chrome.storage.local.set({ processLogs: logs });
    
    // Notify subscribers of new data
    notifySubscribers(logs);
    
    console.log('Storing process logs:', logs); // Debug log
    return logs;
  } catch (error) {
    console.error('Error logging process data:', error);
    return null;
  }
};

// Get process logs with real-time updates
export const getProcessLogs = async () => {
  try {
    const result = await chrome.storage.local.get('processLogs');
    console.log('Retrieved process logs:', result.processLogs); // Debug log
    
    // Start real-time updates
    startRealTimeUpdates();
    
    return result.processLogs || '';
  } catch (error) {
    console.error('Error retrieving process logs:', error);
    return '';
  }
};

// Start real-time updates
const startRealTimeUpdates = () => {
  const updateInterval = setInterval(async () => {
    try {
      const processes = await chrome.processes.getProcessInfo([], true);
      await logProcessData(processes);
    } catch (error) {
      console.error('Error updating process data:', error);
    }
  }, 2000); // Update every 2 seconds

  // Return cleanup function
  return () => clearInterval(updateInterval);
};

// Initialize real-time updates
export const initializeRealTimeUpdates = () => {
  const cleanup = startRealTimeUpdates();
  return cleanup; // Return cleanup function for component unmount
}; 