let blockedSites = [];
let trackingData = {};
let focusMode = false;
let activeTabId = null;
let intervalId = null;
let decisionTree = null;
let modelLoaded = false;

const excludedDomains = [
  "linkedin.com", "github.com", "trello.com", "slack.com", "notion.so",
  "whatsapp.com", "mail.google.com", "outlook.live.com", "coursera.org",
  "udemy.com", "khanacademy.org", "stackoverflow.com", "gitlab.com"
];

/**
 * ✅ AI Model Loading with Retry Mechanism
 */
async function loadDecisionTree(retryCount = 5) {
  try {
    const response = await fetch(chrome.runtime.getURL("decision_tree.json"));
    if (!response.ok) throw new Error("Failed to fetch model");

    decisionTree = await response.json();
    modelLoaded = true;
    console.log("✅ AI Model Loaded Successfully!");
  } catch (error) {
    console.error("❌ AI Model Failed to Load:", error);
    if (retryCount > 0) {
      console.log(`🔄 Retrying AI model load... (${retryCount} attempts left)`);
      setTimeout(() => loadDecisionTree(retryCount - 1), 2000);
    }
  }
}

// Load AI Model
loadDecisionTree();

/**
 * ✅ AI-Based Site Blocking Prediction (ONLY FOR RECOMMENDATION)
 */
function predictSiteBlock(timeSpent, visitsPerDay, workHours, userBlocked) {
  if (!modelLoaded) {
    console.warn("⚠️ AI Model is not ready yet!");
    return 0; // Default: Not distracting
  }

  // ✅ Recommendation threshold (5 seconds) for 30 mis (1800 seconds)
  if (timeSpent >= 5) { 
    console.log(`🛑 AI recommends blocking (time: ${timeSpent} sec)`);
    return 1; 
  }

  const features = [timeSpent, visitsPerDay, workHours, userBlocked];
  return traverseDecisionTree(0, features);
}

/**
 * ✅ Track Browsing Time & Apply Blocking Only for Manually Blocked Sites
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (intervalId) clearInterval(intervalId);
  activeTabId = activeInfo.tabId;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
          const url = new URL(tabs[0].url);
          const hostname = url.hostname;

          if (!trackingData[hostname]) trackingData[hostname] = { time: 0, visits: 1 };
          else trackingData[hostname].visits++;

          intervalId = setInterval(() => {
              trackingData[hostname].time++;

              // ✅ ONLY BLOCK IF THE SITE IS MANUALLY ADDED TO BLOCK LIST
              chrome.storage.sync.get("blockedSites", (data) => {
                  const manuallyBlockedSites = data.blockedSites || [];

                  if (focusMode && manuallyBlockedSites.includes(hostname)) {
                      console.log(`🚫 Manually blocking ${hostname}`);
                      chrome.tabs.update(tabs[0].id, { url: "blocked.html" });
                      clearInterval(intervalId);
                  }
              });

              // Save tracking data
              chrome.storage.sync.set({ trackingData }, () => {
                  if (chrome.runtime.lastError) {
                      console.error("❌ Failed to save tracking data:", chrome.runtime.lastError);
                  }
              });

              chrome.runtime.sendMessage({ type: "updateSummary", trackingData });
          }, 1000);
      }
  });
});

// ✅ Auto-Save Tracking Data Every 30 Seconds
setInterval(() => {
  console.log("💾 Auto-Saving Tracking Data...");
  chrome.storage.sync.set({ trackingData }, () => {
    if (chrome.runtime.lastError) {
      console.error("❌ Failed to auto-save tracking data:", chrome.runtime.lastError);
    }
  });
}, 30000);

/**
 * ✅ Handle Messages from `popup.js`
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "toggleFocusMode":
      focusMode = message.value;
      chrome.storage.sync.set({ focusMode });
      break;

    case "resetTrackingData":
      trackingData = {};
      chrome.storage.sync.set({ trackingData: {} });
      chrome.runtime.sendMessage({ type: "updateSummary", trackingData: {} });
      break;

    case "addBlockedSite":
      const siteToBlock = message.site;
      if (!blockedSites.includes(siteToBlock)) {
        blockedSites.push(siteToBlock);
        chrome.storage.sync.set({ blockedSites });
        alert(`${siteToBlock} has been added to your blocked sites.`);
      }
      break;

    case "getFocusMode":
      sendResponse({ focusMode });
      break;

    default:
      console.warn("⚠️ Unknown message type:", message.type);
  }
});

// ✅ Load initial state from storage
chrome.storage.sync.get(["focusMode", "blockedSites"], (data) => {
  focusMode = data.focusMode || false;
  blockedSites = data.blockedSites || [];
});
