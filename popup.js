document.addEventListener("DOMContentLoaded", () => {
  const focusToggle = document.getElementById("focus-toggle");
  const newTaskInput = document.getElementById("new-task");
  const addTaskButton = document.getElementById("add-task");
  const taskList = document.getElementById("task-list");
  const summaryList = document.getElementById("summary-list");
  const recommendedList = document.getElementById("recommended-list");
  const searchButton = document.getElementById("search-button");
  const searchQueryInput = document.getElementById("search-query");
  const resetSummaryButton = document.getElementById("reset-summary-button");

  const excludedDomains = [
    "linkedin.com",
    "github.com",
    "trello.com",
    "slack.com",
    "notion.so",
    "whatsapp.com",
    "mail.google.com",
    "outlook.live.com",
    "coursera.org",
    "udemy.com",
    "khanacademy.org",
    "stackoverflow.com",
    "gitlab.com",
  ];

  // Function to render the summary list
  const renderSummary = (trackingData) => {
    summaryList.innerHTML = ""; // Clear the list
    for (const [site, time] of Object.entries(trackingData)) {
      const li = document.createElement("li");
      li.textContent = `${site}: ${Math.floor(time / 60)} mins`;
      summaryList.appendChild(li);
    }
  };

  // Render recommended blocked sites
  const renderRecommendations = (sites) => {
    recommendedList.innerHTML = ""; // Clear previous recommendations

    // Filter out excluded domains
    const filteredSites = sites.filter((site) => !excludedDomains.includes(site));

    filteredSites.forEach((site) => {
      const li = document.createElement("li");
      li.textContent = site;

      // Add a "Block" button
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
            chrome.storage.sync.set({ blockedSites });
            alert(`${site} has been added to your blocked sites.`);
            chrome.storage.sync.get("focusMode", (data) => {
              if (data.focusMode) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  const activeTabUrl = new URL(tabs[0].url).hostname;
                  if (blockedSites.includes(activeTabUrl)) {
                    chrome.tabs.update(tabs[0].id, { url: "blocked.html" });
                  }
                });
              }
            });
          }
        });
      });

      li.appendChild(blockButton);
      recommendedList.appendChild(li);
    });
  };

  // Load stored data
  chrome.storage.sync.get(["trackingData", "focusMode", "tasks", "blockedSites"], (data) => {
    const trackingData = data.trackingData || {};
    renderSummary(trackingData); // Render the tracking summary
    focusToggle.checked = data.focusMode || false; // Set focus mode toggle
    renderTasks(data.tasks || []); // Render tasks
    renderRecommendations(data.blockedSites || []); // Render blocked sites
  });

  // Toggle focus mode
  focusToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({ type: "toggleFocusMode", value: focusToggle.checked });
    chrome.storage.sync.set({ focusMode: focusToggle.checked });
  });

  // Google search functionality
  searchButton.addEventListener("click", () => {
    const query = searchQueryInput.value.trim();
    if (query) {
      const googleSearchURL = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      chrome.tabs.create({ url: googleSearchURL });
    }
  });

  // Render tasks
  const renderTasks = (tasks) => {
    taskList.innerHTML = ""; // Clear existing tasks
    tasks.forEach((task) => {
      const li = document.createElement("li");
      li.textContent = task;

      // Add a "Done" button
      const removeButton = document.createElement("button");
      removeButton.textContent = "Done";
      removeButton.classList.add("remove-button");
      removeButton.style.marginLeft = "155px";

      removeButton.addEventListener("click", () => {
        const updatedTasks = tasks.filter((t) => t !== task);
        chrome.storage.sync.set({ tasks: updatedTasks });
        renderTasks(updatedTasks);
      });

      li.appendChild(removeButton);
      taskList.appendChild(li);
    });
  };

  // Add a new task
  addTaskButton.addEventListener("click", () => {
    const task = newTaskInput.value.trim();
    if (task) {
      chrome.storage.sync.get("tasks", (data) => {
        const tasks = data.tasks || [];
        tasks.push(task); // Add the new task
        chrome.storage.sync.set({ tasks }); // Save to storage
        renderTasks(tasks); // Update the task list
      });
      newTaskInput.value = ""; // Clear the input field
    }
  });

  // Reset tracking summary
  resetSummaryButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "resetTrackingData" }, () => {
      summaryList.innerHTML = ""; // Clear the summary list
      recommendedList.innerHTML = ""; // Clear recommendations
      alert("Tracking Summary has been reset. Tracking will start fresh.");
    });
  });

  // Listen for updated tracking data
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "updateSummary") {
      renderSummary(message.trackingData);
    }
    if (message.type === "recommendBlockedSites") {
      renderRecommendations(message.sites);
    }
  });
});
