let blockedSites = [];
let trackingData = {};
let focusMode = false;
let activeTabId = null;
let intervalId = null;

// Load data from storage
chrome.storage.sync.get(["blockedSites", "trackingData", "focusMode"], (data) => {
  blockedSites = data.blockedSites || [];

  // Ensure WhatsApp Web is always blocked
  if (!blockedSites.includes('web.whatsapp.com')) {
    blockedSites.push('web.whatsapp.com');
  }

  trackingData = data.trackingData || {};
  focusMode = data.focusMode || false;
});

// Track browsing time
function startTracking(url) {
  if (!trackingData[url]) {
    trackingData[url] = 0; // Initialize tracking data for new URL
  }

  intervalId = setInterval(() => {
    if (focusMode && blockedSites.includes(url)) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.update(tabs[0].id, { url: "blocked.html" });
      });
      clearInterval(intervalId);
    } else {
      trackingData[url]++;
      chrome.storage.sync.set({ trackingData }); // Update storage every second
    }
  }, 1000);
}

// Clear existing interval and start a new one
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (intervalId) clearInterval(intervalId); // Clear previous interval

  activeTabId = activeInfo.tabId;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = tabs[0].url;
      let hostname;

      try {
        hostname = new URL(url).hostname;
        if (!trackingData[hostname]) trackingData[hostname] = 0;

        intervalId = setInterval(() => {
          if (focusMode && blockedSites.includes(hostname)) {
            chrome.tabs.update(tabs[0].id, { url: "blocked.html" });
            clearInterval(intervalId);
          } else {
            trackingData[hostname]++;
          }

          if (trackingData[hostname] % 5 === 0) {
            chrome.storage.sync.set({ trackingData });
            recommendBlockedSites(); // Call recommendation logic
            chrome.runtime.sendMessage({ type: "updateSummary", trackingData });
          }
        }, 1000);
      } catch (e) {
        console.error("Invalid URL", e);
      }
    }
  });
});

// Recommend blocked sites based on browsing data
function recommendBlockedSites() {
  const threshold = 10; // 5 minutes
  const distractingSites = [];

  for (const [site, time] of Object.entries(trackingData)) {
    if (time > threshold) {
      distractingSites.push(site);
    }
  }

  chrome.runtime.sendMessage({ type: "recommendBlockedSites", sites: distractingSites });
}

// Reset tracking data
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "resetTrackingData") {
    trackingData = {}; // Clear in-memory tracking data
    chrome.storage.sync.set({ trackingData: {} }, () => {
      console.log("Tracking data reset successfully.");
      sendResponse();
    });
    chrome.runtime.sendMessage({ type: "updateSummary", trackingData: {} });
    return true; // Keep the message channel open for async response
  }

  if (message.type === "toggleFocusMode") {
    focusMode = message.value;
    chrome.storage.sync.set({ focusMode });
  }
});

// Handle focus mode toggle
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "toggleFocusMode") {
    focusMode = message.value;
    chrome.storage.sync.set({ focusMode });
  }
});

// Handle tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId && intervalId) {
    clearInterval(intervalId);
  }
});
