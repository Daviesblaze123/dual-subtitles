// Dual Subtitles – background service worker.
// Forwards the keyboard shortcut (set in chrome://extensions/shortcuts) to the
// YouTube tab, where the content script saves the current sentence.

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'save-sentence' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'saveSentence' }).catch(() => {});
  }
});
