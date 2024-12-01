// Add trial token handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_TRIAL_TOKEN') {
    chrome.storage.local.set({ aiTrialToken: message.token }, () => {
      console.log('Trial token set');
      if (chrome.runtime.lastError) {
        console.error('Error setting trial token:', chrome.runtime.lastError);
      }
    });
  }
});

chrome.action.onClicked.addListener(() => {
  console.log('Opening extension window...');
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 1200,
    height: 800
  }, (window) => {
    console.log('Extension window created:', window);
  });
}); 