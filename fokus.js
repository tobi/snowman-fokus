// ==UserScript==
// @name         Focus8
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Block specified websites with an enable/disable menu and overlay
// @author       Tobi
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

// Only create in top-level frame
if (window.self !== window.top) return null;

function main() {
  "use strict";

  // Utility functions
  const getValue = (key, defaultValue) => GM_getValue(key, defaultValue);
  const setValue = (key, value) => GM_setValue(key, value);
  const notify = (message, title = "fokus") => GM_notification(message, title);

  // Main functions
  const getBlockedHosts = () => getValue("blockedHosts", []);
  const setBlockedHosts = (hosts) => setValue("blockedHosts", hosts);
  const getBlockingEnabled = () => getValue("blockingEnabled", false);
  const setBlockingEnabled = (enabled) => setValue("blockingEnabled", enabled);
  const getExemptUntil = () => new Date(getValue("exemptUntil_global", 0));
  const setExemptUntil = (until) =>
    setValue("exemptUntil_global", until.toISOString());
  const clearExemptUntil = () => setValue("exemptUntil_global", 0);

  const updateBlockCount = async (host) => {
    const counts = await getBlockCounts();
    counts.hosts[host] = (counts.hosts[host] || 0) + 1;
    await setBlockCounts(counts);
  };

  const updateExemptionCount = async (host) => {
    const counts = await getBlockCounts();
    counts.exemptions[host] = (counts.exemptions[host] || 0) + 1;
    await setBlockCounts(counts);
  };

  const getBlockCounts = async () => {
    const counts = await getValue("blockCounts", {});
    const today = new Date().toISOString().split("T")[0];

    if (counts.date !== today) {
      counts.date = today;
      counts.hosts = {};
      counts.exemptions = {};
    }

    return counts;
  };

  const setBlockCounts = (counts) => setValue("blockCounts", counts);

  const invalidateState = () => {
    window.location.reload();
  };

  const toggleBlocking = async () => {
    const newState = !(await getBlockingEnabled());
    await setBlockingEnabled(newState);
    notify(`Blocking is now ${newState ? "enabled" : "disabled"}.`);
    invalidateState();
  };

  const addBlockedHost = async (host) => {
    const blockedHosts = await getBlockedHosts();
    if (!blockedHosts.includes(host)) {
      blockedHosts.push(host);
      await setBlockedHosts(blockedHosts);
      notify(`${host} added to blocked hosts.`);
    } else {
      notify(`${host} is already in the blocked hosts list.`);
    }
  };

  const removeBlockedHost = async (host) => {
    const blockedHosts = await getBlockedHosts();
    const index = blockedHosts.indexOf(host);
    if (index !== -1) {
      blockedHosts.splice(index, 1);
      await setBlockedHosts(blockedHosts);
      notify(`${host} removed from blocked hosts.`);
    } else {
      notify(`${host} is not in the blocked hosts list.`);
    }
  };

  const blockCurrentPage = async () => {
    const host = window.location.hostname.replace(/^www\./, "");
    await addBlockedHost(host);
    invalidateState();
  };

  const unblockCurrentPage = async () => {
    const host = window.location.hostname.replace(/^www\./, "");
    await removeBlockedHost(host);
    invalidateState();
  };

  const exemptFor = async (seconds, host) => {
    const exemptUntil = new Date(Date.now() + seconds * 1000);
    await setExemptUntil(exemptUntil);
    await updateExemptionCount(host);
    invalidateState();
  };

  const createCountdownToast = async () => {
    const host = document.createElement("span", {
      id: "fokus-countdown-toast",
    });
    const shadowRoot = host.attachShadow({ mode: "closed" });

    const toast = document.createElement("div");
    toast.id = "fokus-countdown-toast";

    const style = document.createElement("style");
    style.textContent = `
      @keyframes pop {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }

      @keyframes textChange {
        0% { opacity: 0; transform: translateY(10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }

      #fokus-countdown-toast {
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        background-color: rgba(0, 0, 0, 0.7);
        color: #fff;
        border-radius: 4px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        z-index: 2147483647;
        transition: color 0.3s ease;
        cursor: pointer;

      }

      #fokus-countdown-toast:hover::after {
        content: "dismiss";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 10px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s ease, top 0.3s ease;
      }

      #fokus-countdown-toast:hover::after {
        opacity: 1;
        top: calc(100% + 5px);
      }

      #fokus-countdown-toast span {
        display: inline-block;
        animation: textChange 1s ease-in-out infinite;
      }

      #fokus-countdown-toast.urgent {
        color: #ff0000;
        animation: pop 0.3s ease infinite;
      }
    `;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(toast);

    toast.addEventListener("click", () => {
      clearExemptUntil();
      invalidateState();
    });

    const updateCountdown = async () => {
      const exemptUntil = await getExemptUntil();
      let duration = Math.floor((exemptUntil - new Date()) / 1000);

      if (duration <= 0) {
        invalidateState();
        return;
      }

      if (duration <= 15) {
        toast.classList.add("urgent");
      }

      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      toast.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      requestAnimationFrame(updateCountdown);
    };

    updateCountdown();

    // Find and remove the existing countdown element
    const existingCountdown = document.getElementById("fokus-countdown-toast");
    if (existingCountdown) {
      existingCountdown.remove();
    }
    document.body.appendChild(host);
  };

  const renderQuotes = async () => {
    const token = await getValue("readwise-key");
    if (!token) {
      notify("Please manually add readwise-key value");
      return document.createDocumentFragment();
    }

    const fetchDailyReview = async () => {
      const cache = await getValue("highlights", {});
      if (cache && cache.valid_until > Date.now()) {
        return cache.highlights;
      }

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: "https://readwise.io/api/v2/review/",
          headers: { Authorization: `Token ${token}` },
          onload: (response) => {
            if (response.status === 200) {
              const highlights = JSON.parse(response.responseText).highlights;
              setValue("highlights", {
                highlights,
                valid_until: Date.now() + 24 * 60 * 60 * 1000,
              });
              resolve(highlights);
            } else {
              reject(new Error(`Failed to fetch data: ${response.statusText}`));
            }
          },
          onerror: (err) => reject(new Error(`Network error: ${err}`)),
        });
      });
    };

    const convertMarkdownToHtml = (text) => {
      return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
          /\[(.*?)\]\((.*?)\)/g,
          '<a href="$2" rel="noopener noreferrer">$1</a>'
        );
    };

    const fragment = document.createDocumentFragment();

    try {
      const highlights = await fetchDailyReview();
      const shuffledHighlights = highlights.sort(() => Math.random() - 0.5);

      shuffledHighlights.forEach((highlight) => {
        const quoteInstance = document.createElement("div");
        quoteInstance.className = "quote-card";
        quoteInstance.innerHTML = `
          <blockquote>
            <p>${convertMarkdownToHtml(highlight.text)}
            <cite>
              <span class="title">${highlight.title}</span>
              <span class="author">by ${highlight.author}</span>
            </cite>
            </p>
            <figure>
              ${
                highlight.image_url
                  ? `<img src="${highlight.image_url}" alt="${highlight.title}" onerror="this.style.display='none'">`
                  : ""
              }
            </figure>
          </blockquote>
        `;
        fragment.appendChild(quoteInstance);
      });
    } catch (error) {
      console.error("Error fetching quotes:", error);
    }

    return fragment;
  };

  const renderStats = async () => {
    const counts = await getBlockCounts();
    const hosts = counts.hosts || {};

    const fragment = document.createDocumentFragment();

    Object.entries(hosts).forEach(([host, count]) => {
      const barContainer = document.createElement("div");
      barContainer.className = "stat-item";

      const label = document.createElement("span");
      label.className = "stat-label";
      label.textContent = host;

      const value = document.createElement("span");
      value.className = "stat-value";
      value.textContent = `${count}x`;

      barContainer.appendChild(label);
      barContainer.appendChild(value);
      fragment.appendChild(barContainer);
    });

    return fragment;
  };

  const createBlockedOverlay = async () => {
    const overlay = document.createElement("div");
    overlay.id = "blocked-overlay";

    const shadowRoot = overlay.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `

      :host {
        all: initial;
      }

      .blocked-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: #4158D0;
        background-image: linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        overflow-y: auto;
      }

      section {
        background-color: rgba(245, 245, 245);
        box-shadow: 0 4px 4px rgba(0, 0, 0, 0.4);
        border-radius: 3px;
        padding: 40px;
        max-width: 800px;
        width: 90%;
        position: absolute;
        max-width: 700px;
        margin: 40px auto;
        position: relative; // Change this line
      }

      .header {
        height: 100px;
        display: flex;
        align-items: center;
        margin-bottom: 30px;
        justify-content: space-between;
      }

      .profile {
        display: flex;
        align-items: center;
      }

      .profile-image {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        font-size: 39pt;
        background: white;
        text-align: center;
        margin-right: 20px;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
      }
      .profile-info h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .profile-info p {
        margin: 5px 0 0;
        color: #4a90e2;
        font-size: 18px;
      }
      .quote {
        font-style: italic;
        color: #555;
        margin-bottom: 30px;
        line-height: 1.6;
        font-size: 15px;
      }
      .stats, .quotes {
        margin-top: 30px;
      }
      .quote-card {
        background-color: white;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease-in-out;
      }
      .quote-card:hover {
        transform: translateY(-5px);
      }
      blockquote {
        display: flex;
        align-items: flex-start;
        margin: 0;
        padding: 0 0 0 15px;
        border-left: 3px solid #4a90e2;
        justify-content: space-between;
      }
      blockquote p {
        margin: 0 0 10px;
        line-height: 1.5;
        flex: 1 1 auto;
        padding-right: 15px;
      }
      blockquote figure {
        border-radius: 4px;
        box-shadow: 0 2px 2px rgba(0, 0, 0, 0.4);
        object-fit: contain;
        width: 200px;
        height: auto;
      }

      blockquote figure img {
        max-width: 100%;
        height: auto;
      }

      cite {
        display: block;
        margin-top: 10px;
        font-size: 0.9em;
        color: #777;
      }
      .title {
        font-weight: 600;
      }
      .stat-item {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        background-color: white;
        padding: 10px 15px;
        border-radius: 6px;
        #box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);

      }
      .stat-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .stat-value {
        margin-left: 10px;
        font-weight: 600;
        color: #4a90e2;
      }

      .quick-enable-button {
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 5px;
        font-size: 16px;
        cursor: pointer;
        transition: background-color 0.2s ease-in-out;
      }

      .quick-enable-button:hover {
        background-color: #357abd;
        transform: scale(1.01);
        transition: all 0.2s ease-in-out;
      }
      .quick-enable-button:active {
        transform: scale(0.95);
        box-shadow: 0 0 10px rgba(0,0,0,0.3) inset;
      }

    `;

    const content = document.createElement("div");
    content.className = "blocked-container";
    content.innerHTML = `
      <section>
        <div class="header">
          <div class="profile">
          <figure class="profile-image">
            ☃︎
          </figure>

          <div class="profile-info">
            <h1>Snowman says no</h1>
            <p>Stay Focused &amp; stay frosty...</p>
          </div>
          </div>

          <button class="quick-enable-button">Enable for 5 minutes</button>
        </div>
        <div class="quote">
          <!-- "Success is not final, failure is not fatal: it is the courage to continue that counts." -->
        </div>
        <div class="stats"></div>
        <div class="quotes"></div>
      </section>
    `;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(content);

    const statsContainer = content.querySelector(".stats");
    const quotesContainer = content.querySelector(".quotes");
    const quickEnableButton = content.querySelector(".quick-enable-button");
    quickEnableButton.addEventListener("click", async () => {
      const host = window.location.hostname.replace(/^www\./, "");
      await exemptFor(5 * 60, host);
    });

    const stats = await renderStats();
    const quotes = await renderQuotes();

    statsContainer.appendChild(stats);
    quotesContainer.appendChild(quotes);

    const existingOverlay = document.getElementById("blocked-overlay");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    document.body.appendChild(overlay);
  };

  // Main execution
  (async () => {
    const host = window.location.hostname.replace(/^www\./, "");
    const blockedHosts = await getBlockedHosts();
    const blockingEnabled = await getBlockingEnabled();
    const exemptUntil = await getExemptUntil();

    let isBlocked =
      blockedHosts.some((e) => host.includes(e)) && blockingEnabled;

    if (exemptUntil > new Date()) {
      createCountdownToast();
    } else if (isBlocked) {
      document.documentElement.innerHTML = "";
      updateBlockCount(host);
      createBlockedOverlay();
    }

    // Register menu commands
    GM_registerMenuCommand(`Enable for 5 Minutes`, () => exemptFor(5, host));
    GM_registerMenuCommand(
      `${blockingEnabled ? "Disable" : "Enable"} Blocking`,
      toggleBlocking
    );
    GM_registerMenuCommand(
      isBlocked ? `Unblock ${host}` : `Block ${host}`,
      isBlocked ? unblockCurrentPage : blockCurrentPage
    );
  })();
}

main();
