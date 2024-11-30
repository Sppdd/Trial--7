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