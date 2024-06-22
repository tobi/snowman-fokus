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

const currentHost = window.location.hostname.replace(/^www\./, "");

const getValue = (key, defaultValue) => GM_getValue(key, defaultValue);
const setValue = (key, value) => GM_setValue(key, value);
const notify = (message, title = "fokus") => GM_notification(message, title);
const getExemptUntil = () => new Date(getValue("exemptUntil_global", 0));
const getBlockedHosts = () => getValue("blockedHosts", []);
const isHostBlocked = (host) => getBlockedHosts().some((e) => host.includes(e));
const setBlockedHosts = (hosts) => setValue("blockedHosts", hosts);
const getBlockingEnabled = () => getValue("blockingEnabled", false);
const setBlockingEnabled = (enabled) => setValue("blockingEnabled", enabled);
const setExemptUntil = (until) =>
  setValue("exemptUntil_global", until.toISOString());

const shouldBlock = () => {
  if (!getBlockingEnabled()) {
    return false;
  }

  const exemptUntil = getExemptUntil();
  if (exemptUntil > new Date()) {
    return false;
  }

  return isHostBlocked(currentHost);
};

function createBlockedOverlay() {
  const overlay = document.getElementById("blocked-overlay") || document.createElement("div", { id: "blocked-overlay" });

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
      // background-color: #4158D0;
      // background-image: linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%);
      background-color: #8BC6EC;
      background-image: linear-gradient(135deg, #8BC6EC 0%, #9599E2 100%);

      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
      left: 50%;
      transform: translate(-50%, 0%);
      margin-top: 40px;
    }

    .profile {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
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
      margin: 0;
      padding: 0;
      border-left: 3px solid #4a90e2;
      padding-left: 15px;
    }
    blockquote p {
      margin: 0 0 10px;
      line-height: 1.5;
    }
    blockquote img {
      max-width: 90px;
      max-height: 120px;
      float: right;
      margin-left: 15px;
      border-radius: 4px;
      box-shadow: 0 2px 2px rgba(0, 0, 0, 0.4);

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
      float: right;
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
  `;

  const content = document.createElement("div");
  content.className = "blocked-container";
  content.innerHTML = `html
    <section>
      <div class="profile">
        <figure class="profile-image">
          ☃︎
        </figure>

        <div class="profile-info">
          <h1>Snowman says no</h1>
          <p>Stay Focused &amp; stay frosty...</p>
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

  // const statsContainer = content.querySelector(".stats");
  // const quotesContainer = content.querySelector(".quotes");
  // const quickEnableButton = content.querySelector(".quick-enable-button");
  // quickEnableButton.addEventListener("click", async () => {
  //   await exemptFor(5, currentHost);
  // });

  // const stats = createStatsElement();
  // console.log(stats);
  // const quotes = createQuotesElement();
  // console.log(quotes);

  // content.replaceChild(statsContainer, stats);
  // content.replaceChild(quotesContainer, quotes);

  return overlay;
}

function createStatsElement() {
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
}

function createQuotesElement() {
  const token = getValue("readwise-key");
  if (!token) {
    notify("Please manually add readwise-key value");
    return document.createDocumentFragment();
  }

  const fetchDailyReview = async () => {
    const cache = getValue("highlights", {});
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

  const el = document.createElement("div");
  el.className = "quotes";

  const update = async () => {
    el.innerHTML = "";
    const highlights = await fetchDailyReview();
    const shuffledHighlights = highlights.sort(() => Math.random() - 0.5);

    shuffledHighlights.forEach((highlight) => {
      const quoteInstance = document.createElement("div");
      quoteInstance.className = "quote-card";
      quoteInstance.innerHTML = `
        <blockquote>
          ${
            highlight.image_url
              ? `<img src="${highlight.image_url}" alt="${highlight.title}" onerror="this.style.display='none'">`
              : ""
          }
          <p>${convertMarkdownToHtml(highlight.text)}</p>
          <cite>
            <span class="title">${highlight.title}</span>
            <span class="author">by ${highlight.author}</span>
          </cite>
        </blockquote>
      `;
      el.appendChild(quoteInstance);
    });
  };
  update();

  return el;
}

function createCountdownToast() {
  if (!isHostBlocked(currentHost)) {
    const toast = document.getElementById("fokus-countdown-toast");
    if (toast) {
      toast.remove();
    }
    return;
  }

  const toast = document.createElement("div");
  toast.id = "fokus-countdown-toast";
  const shadowRoot = toast.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 15px;
      background-color: #333;
      color: #fff;
      border-radius: 8px;
      z-index: 10001;
      font-size: 16px;
      min-width: 80px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    :host(.urgent) {
      color: #e74c3c;
    }
  `;

  const content = document.createElement("div");
  content.id = "countdown-toast";

  shadowRoot.appendChild(style);
  shadowRoot.appendChild(content);

  const updateCountdown = async () => {
    const exemptUntil = await getExemptUntil();
    let duration = Math.floor((exemptUntil - new Date()) / 1000);

    if (duration <= 0) {
      createCountdownToast();
      createBlockedOverlay();
      return;
    }

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    content.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    if (duration <= 15) {
      toast.classList.add("urgent");
    }

    setTimeout(updateCountdown, 1000);
  };
  updateCountdown();

  document.body.appendChild(toast);
}

// Main execution
async function main() {
  const isBlocked = await isHostBlocked(currentHost);

  // ux
  createBlockedOverlay();
  createCountdownToast();

  const toggleBlocking = async () => {
    const newState = !(await getBlockingEnabled());
    await setBlockingEnabled(newState);
    notify(`Blocking is now ${newState ? "enabled" : "disabled"}.`);
    createBlockedOverlay();
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
    await addBlockedHost(currentHost);
    createBlockedOverlay();
  };

  const unblockCurrentPage = async () => {
    await removeBlockedHost(currentHost);
    createBlockedOverlay();
  };

  // Register menu commands
  GM_registerMenuCommand(`Enable for 5 Minutes`, () =>
    exemptFor(5, currentHost)
  );
  GM_registerMenuCommand(
    `${getBlockingEnabled() ? "Disable" : "Enable"} Blocking`,
    toggleBlocking
  );
  GM_registerMenuCommand(
    isBlocked ? `Unblock ${currentHost}` : `Block ${currentHost}`,
    isBlocked ? unblockCurrentPage : blockCurrentPage
  );
}

main();

// Main functions
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

const exemptFor = async (minutes, host) => {
  const exemptUntil = new Date(Date.now() + minutes * 60 * 1000);
  await setExemptUntil(exemptUntil);
  await updateExemptionCount(host);
  window.location.reload();
};
