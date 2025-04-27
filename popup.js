document.addEventListener("DOMContentLoaded", () => {
  const focusToggle = document.getElementById("focus-toggle");
  const summaryList = document.getElementById("summary-list");
  const recommendedList = document.getElementById("recommended-list");
  const searchButton = document.getElementById("search-button");
  const searchQueryInput = document.getElementById("search-query");
  const resetSummaryButton = document.getElementById("reset-summary-button");
  const newTaskInput = document.getElementById("new-task");
  const addTaskButton = document.getElementById("add-task");
  const taskList = document.getElementById("task-list");

  let decisionTree = null;
  let blockedSites = [];
  let modelLoaded = false;

  // ✅ Load AI Decision Tree with Retry Mechanism
  async function loadDecisionTree(retryCount = 5) {
    try {
      console.log("⏳ Loading AI Model...");
      const response = await fetch(chrome.runtime.getURL("decision_tree.json"));
      if (!response.ok) throw new Error("Failed to fetch AI model");

      decisionTree = await response.json();
      modelLoaded = true;
      console.log("✅ AI Model Loaded Successfully!", decisionTree);
    } catch (error) {
      console.error("❌ AI Model Load Failed:", error);
      if (retryCount > 0) {
        console.log(`🔄 Retrying AI Model Load... (${retryCount} attempts left)`);
        setTimeout(() => loadDecisionTree(retryCount - 1), 2000);
      }
    }
  }
  loadDecisionTree();

  // ✅ Excluded Domains (Work/Productive Sites)
  const excludedDomains = [
    "linkedin.com", "github.com", "trello.com", "slack.com",
    "notion.so", "whatsapp.com", "mail.google.com", "outlook.live.com",
    "coursera.org", "udemy.com", "khanacademy.org", "stackoverflow.com", "gitlab.com"
  ];

  // ✅ AI-Based Prediction Function (ONLY FOR RECOMMENDATION)
  function predictSiteBlock(timeSpent, visitsPerDay, workHours, userBlocked) {
    if (!modelLoaded || !decisionTree) {
      console.warn("⚠️ AI Model is not ready yet!");
      return 0;
    }

    console.log(`🔍 AI Checking: time=${timeSpent}, visits=${visitsPerDay}, workHours=${workHours}, userBlocked=${userBlocked}`);

    if (timeSpent >= 5 || visitsPerDay > 5) {
      console.log(`🛑 AI recommends blocking (time: ${timeSpent} sec, visits: ${visitsPerDay})`);
      return 1;
    }

    return 0;
  }

  // ✅ Render Browsing Summary
  function renderSummary(trackingData) {
    summaryList.innerHTML = "";
    if (!trackingData || Object.keys(trackingData).length === 0) {
      summaryList.innerHTML = "<li>No browsing data available</li>";
      return;
    }

    for (const [site, data] of Object.entries(trackingData)) {
      const li = document.createElement("li");
      li.textContent = `${site}: ${Math.floor(data.time / 60)} mins, Visits: ${data.visits}`;
      summaryList.appendChild(li);
    }
  }

  // ✅ Render Recommended Sites for Blocking (AI)
  function renderRecommendations(trackingData) {
    recommendedList.innerHTML = "";

    if (!trackingData || Object.keys(trackingData).length === 0) {
      recommendedList.innerHTML = "<li>No sites recommended for blocking</li>";
      return;
    }

    console.log("🔍 Checking AI-based recommendations...");
    const sitesToRecommend = [];

    for (const [site, data] of Object.entries(trackingData)) {
      if (excludedDomains.some(domain => site.includes(domain))) {
        console.log(`⏩ Skipping excluded domain: ${site}`);
        continue;
      }

      let isWorkHours = new Date().getHours() >= 9 && new Date().getHours() <= 17 ? 1 : 0;
      let userBlocked = blockedSites.includes(site) ? 1 : 0;

      let shouldBlock = predictSiteBlock(data.time, data.visits, isWorkHours, userBlocked);
      console.log(`🔍 ${site} - Time: ${data.time}, Visits: ${data.visits}, AI Decision: ${shouldBlock}`);

      if (shouldBlock) {
        sitesToRecommend.push(site);
      }
    }

    if (sitesToRecommend.length === 0) {
      recommendedList.innerHTML = "<li>No sites recommended for blocking</li>";
      return;
    }

    sitesToRecommend.forEach((site) => {
      const li = document.createElement("li");
      li.textContent = site;

      const blockButton = document.createElement("button");
      blockButton.textContent = "Block";
      blockButton.style.marginLeft = "10px";
      blockButton.style.backgroundColor = "#ff9800";
      blockButton.style.color = "#fff";
      blockButton.style.border = "none";
      blockButton.style.cursor = "pointer";

      blockButton.addEventListener("click", () => {
        chrome.storage.sync.get("blockedSites", (data) => {
          const blockedSites = data.blockedSites || [];

          if (!blockedSites.includes(site)) {
            blockedSites.push(site);
            chrome.storage.sync.set({ blockedSites }, () => {
              alert(`${site} has been manually added to your blocked sites.`);
              chrome.runtime.sendMessage({ type: "addBlockedSite", site });
            });
          }
        });
      });

      li.appendChild(blockButton);
      recommendedList.appendChild(li);
    });
  }

  // ✅ Load To-Do List from Storage
  function renderTasks() {
    chrome.storage.sync.get("tasks", (data) => {
      const tasks = data.tasks || [];
      taskList.innerHTML = ""; // Clear existing tasks

      tasks.forEach((task) => {
        const li = document.createElement("li");
        li.textContent = task;

        const removeButton = document.createElement("button");
        removeButton.textContent = "Done";
        removeButton.classList.add("remove-button");
        removeButton.style.marginLeft = "155px";

        removeButton.addEventListener("click", () => {
          const updatedTasks = tasks.filter((t) => t !== task);
          chrome.storage.sync.set({ tasks: updatedTasks }, () => {
            renderTasks(); // Update the task list
          });
        });

        li.appendChild(removeButton);
        taskList.appendChild(li);
      });
    });
  }

  // ✅ Add a new task to To-Do List
  addTaskButton.addEventListener("click", () => {
    const task = newTaskInput.value.trim();
    if (task) {
      chrome.storage.sync.get("tasks", (data) => {
        const tasks = data.tasks || [];
        tasks.push(task);
        chrome.storage.sync.set({ tasks }, () => {
          renderTasks(); // Refresh the list
        });
      });
      newTaskInput.value = ""; // Clear the input field
    }
  });

    // ✅ Google Search Functionality
    searchButton.addEventListener("click", () => {
      const query = searchQueryInput.value.trim();
      if (query) {
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: googleSearchUrl });
      }
    });
  
    // Optional: Also trigger search when Enter key is pressed
    searchQueryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        searchButton.click();
      }
    });
  

  // ✅ Load Data from Storage
  chrome.storage.sync.get(["trackingData", "focusMode", "blockedSites", "tasks"], (data) => {
    renderSummary(data.trackingData || {});
    focusToggle.checked = data.focusMode || false;
    blockedSites = data.blockedSites || [];
    renderRecommendations(data.trackingData || {});
    renderTasks(); // ✅ Load saved tasks when popup opens
  });

  // ✅ Toggle Focus Mode (Only Blocks Manually Added Sites)
  focusToggle.addEventListener("change", () => {
    const newFocusMode = focusToggle.checked;
    chrome.runtime.sendMessage({ type: "toggleFocusMode", value: newFocusMode });
    chrome.storage.sync.set({ focusMode: newFocusMode });

    alert(`Focus Mode is now ${newFocusMode ? "Enabled" : "Disabled"}`);
  });

  // ✅ Listen for Updates from `background.js`
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "updateSummary") {
      renderSummary(message.trackingData);
      renderRecommendations(message.trackingData);
    }
  });
});
