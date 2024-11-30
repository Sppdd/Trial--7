const formatProcessData = (processes) => {
  const timestamp = new Date().toISOString();
  let dataRows = [];

  Object.entries(processes).forEach(([id, process]) => {
    const cpu = process.cpu?.toFixed(1) || '0.0';
    const memory = (process.privateMemory / (1024 * 1024)).toFixed(1) || '0.0';
    const network = process.network?.toFixed(1) || '0.0';
    const type = process.type || 'unknown';
    const name = process.tasks?.[0]?.title || process.type || 'unnamed';
    
    dataRows.push(
      `${timestamp}\t${id}\t${type}\t${name}\t${cpu}\t${memory}\t${network}`
    );
  });

  return dataRows.join('\n');
};

export const logProcessData = async (processes) => {
  try {
    const header = 'Timestamp\tProcess ID\tType\tName\tCPU (%)\tMemory (MB)\tNetwork (KB/s)';
    const formattedData = formatProcessData(processes);
    
    // Store single point of data with header
    const logs = `${header}\n${formattedData}`;
    
    await chrome.storage.local.set({ processLogs: logs });
    console.log('Storing process logs:', logs); // Debug log
    
    return logs;
  } catch (error) {
    console.error('Error logging process data:', error);
    return null;
  }
};

export const getProcessLogs = async () => {
  try {
    const result = await chrome.storage.local.get('processLogs');
    console.log('Retrieved process logs:', result.processLogs); // Debug log
    return result.processLogs || '';
  } catch (error) {
    console.error('Error retrieving process logs:', error);
    return '';
  }
}; 