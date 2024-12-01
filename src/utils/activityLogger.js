/**
 * Chrome Activity Logger Module
 * 
 * This module tracks and stores real-time Chrome activities including:
 * - Tab activities (creation, updates, deletion)
 * - Browsing history
 * - Network requests
 * 
 * Data is stored in a tabular format with timestamps for analysis
 */

// Store for activity subscribers
let activitySubscribers = new Set();

// Subscribe to activity updates
export const subscribeToActivityUpdates = (callback) => {
  activitySubscribers.add(callback);
  return () => activitySubscribers.delete(callback);
};

// Notify subscribers of new activity data
const notifyActivitySubscribers = (data) => {
  activitySubscribers.forEach(callback => callback(data));
};

// Format timestamp
const getTimestamp = () => new Date().toISOString();

// Format tab activity data
const formatTabActivity = (tabId, action, details) => {
  return {
    timestamp: getTimestamp(),
    type: 'tab',
    action,
    tabId,
    url: details.url || 'unknown',
    title: details.title || 'unknown',
    status: details.status || 'unknown'
  };
};

// Format history activity data
const formatHistoryActivity = (details) => {
  return {
    timestamp: getTimestamp(),
    type: 'history',
    url: details.url,
    title: details.title || 'unknown',
    visitCount: details.visitCount || 1,
    lastVisitTime: new Date(details.lastVisitTime).toISOString()
  };
};

// Format web request data
const formatWebRequest = (details) => {
  return {
    timestamp: getTimestamp(),
    type: 'request',
    url: details.url,
    method: details.method,
    tabId: details.tabId,
    type: details.type,
    size: details.requestSize || 0,
    status: details.statusCode
  };
};

// Store activities in Chrome storage
const storeActivity = async (activity) => {
  try {
    // Get existing activities
    const result = await chrome.storage.local.get('activities');
    const activities = result.activities || [];
    
    // Add new activity and keep last 1000 entries
    activities.push(activity);
    if (activities.length > 1000) {
      activities.shift();
    }
    
    // Store updated activities
    await chrome.storage.local.set({ activities });
    notifyActivitySubscribers(activities);
    
  } catch (error) {
    console.error('Error storing activity:', error);
  }
};

// Initialize tab activity tracking
const initTabTracking = () => {
  // Track tab creation
  chrome.tabs.onCreated.addListener(async (tab) => {
    const activity = formatTabActivity(tab.id, 'created', tab);
    await storeActivity(activity);
  });

  // Track tab updates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      const activity = formatTabActivity(tabId, 'updated', tab);
      await storeActivity(activity);
    }
  });

  // Track tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const activity = formatTabActivity(tabId, 'removed', { url: 'closed' });
    await storeActivity(activity);
  });
};

// Initialize history tracking
const initHistoryTracking = () => {
  chrome.history.onVisited.addListener(async (historyItem) => {
    const activity = formatHistoryActivity(historyItem);
    await storeActivity(activity);
  });
};

// Initialize web request tracking
const initWebRequestTracking = () => {
  chrome.webRequest.onCompleted.addListener(
    async (details) => {
      const activity = formatWebRequest(details);
      await storeActivity(activity);
    },
    { urls: ['<all_urls>'] }
  );
};

// Get stored activities
export const getActivities = async () => {
  try {
    const result = await chrome.storage.local.get('activities');
    return result.activities || [];
  } catch (error) {
    console.error('Error getting activities:', error);
    return [];
  }
};

// Format activities as table string
export const getActivityTable = async () => {
  const activities = await getActivities();
  let table = 'Timestamp\tType\tAction\tURL\tDetails\n';
  
  activities.forEach(activity => {
    let details = '';
    switch (activity.type) {
      case 'tab':
        details = `TabID: ${activity.tabId}, Status: ${activity.status}`;
        break;
      case 'history':
        details = `Visits: ${activity.visitCount}, Last: ${activity.lastVisitTime}`;
        break;
      case 'request':
        details = `Method: ${activity.method}, Size: ${activity.size}B, Status: ${activity.status}`;
        break;
    }
    
    table += `${activity.timestamp}\t${activity.type}\t${activity.action || '-'}\t${activity.url}\t${details}\n`;
  });
  
  return table;
};

// Initialize all tracking
export const initializeActivityTracking = () => {
  initTabTracking();
  initHistoryTracking();
  initWebRequestTracking();
  
  // Return cleanup function
  return () => {
    activitySubscribers.clear();
  };
}; 