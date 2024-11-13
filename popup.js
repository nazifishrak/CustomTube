const DEFAULT_CATEGORIES = {
  distraction: {
    enabled: false,
    threshold: 0.6,
    keywords: [ // Entertainment keywords
      "entertainment", "celebrity", "gossip", "viral", "funny", "comedy", "meme",
      "challenge", "reaction", "reacts", "prank", "drama", "tv", "music", "movie",
      "dance", "cover", "gaming", "minecraft", "fortnite", "trending", "vlog",
      "fun", "unboxing", "reviewing", "ranking", "exploring", "commenting", "parody",

      // Political keywords
      "politics", "debate", "election", "government", "policy", "trump", "biden",
      "congress", "democracy", "news", "analysis", "scandal", "protest", "freedom",
      "laws", "activism", "speech", "campaign", "reacting", "explaining",
      "discussing", "criticizing", "supporting", "reviewing"]
  },
  everything: {
    enabled: false,
    threshold: 0.1,
    keywords: ['*']
  }
};

class PopupManager {
  constructor() {
    this.categories = {};
    this.container = document.getElementById('categories');
    this.isUpdating = false;
  }

  async init() {
    try {
      await this.loadSettings();
      this.renderCategories();
      this.setupEventListeners();
      await this.checkYouTubeTabs(); // Check existing YouTube tabs on popup open
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showNotification('Failed to initialize settings', 'error');
    }
  }

  async checkYouTubeTabs() {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      if (tabs.length > 0) {
        // Try to ping each tab to see if content script is ready
        let needsReload = false;
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
          } catch (error) {
            needsReload = true;
            break;
          }
        }

        if (needsReload) {
          this.showReloadMessage();
        }
      }
    } catch (error) {
      console.error('Error checking YouTube tabs:', error);
    }
  }

  showReloadMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'reload-message';
    messageDiv.innerHTML = `
      <div class="alert">
        <p>⚠️ Please reload YouTube tabs for changes to take effect</p>
        <button id="reloadTabs" class="reload-btn">Reload YouTube Tabs</button>
      </div>
    `;

    // Insert at the top of the popup
    this.container.parentNode.insertBefore(messageDiv, this.container);

    // Add click handler for reload button
    document.getElementById('reloadTabs').addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      for (const tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
      messageDiv.remove();
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['categories']);
      this.categories = result.categories || DEFAULT_CATEGORIES;
      console.log('Loaded settings:', this.categories);
    } catch (error) {
      console.error('Error loading settings:', error);
      this.categories = DEFAULT_CATEGORIES;
      throw error;
    }
  }

  renderCategories() {
    if (!this.container) {
      console.error('Categories container not found');
      return;
    }

    this.container.innerHTML = '';
    Object.entries(this.categories).forEach(([name, category]) => {
      const div = document.createElement('div');
      div.className = 'category';

      // Create category header with toggle
      const header = document.createElement('div');
      header.className = 'category-header';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = name;
      checkbox.checked = category.enabled;
      checkbox.disabled = this.isUpdating;

      const label = document.createElement('label');
      label.htmlFor = name;
      label.textContent = name.charAt(0).toUpperCase() + name.slice(1);

      header.appendChild(checkbox);
      header.appendChild(label);
      div.appendChild(header);

      // Only add keyword management for "distraction" category
      if (name === 'distraction') {
        // Add keyword input and list
        this.addKeywordManagement(div, category);
      }

      this.container.appendChild(div);
    });
  }

  addKeywordManagement(div, category) {
    const inputContainer = document.createElement('div');
    inputContainer.className = 'keyword-input-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'keyword-input';
    input.placeholder = 'Add new keyword';

    const addButton = document.createElement('button');
    addButton.className = 'add-keyword-btn';
    addButton.textContent = 'Add';

    inputContainer.appendChild(input);
    inputContainer.appendChild(addButton);
    div.appendChild(inputContainer);

    // Add keyword list
    const keywordList = document.createElement('div');
    keywordList.className = 'keyword-list';

    category.keywords.forEach(keyword => {
      const tag = document.createElement('div');
      tag.className = 'keyword-tag';
      tag.innerHTML = `
        <span>${keyword}</span>
        <button class="remove-keyword" data-keyword="${keyword}">×</button>
      `;
      keywordList.appendChild(tag);
    });

    div.appendChild(keywordList);

    // Add event listeners
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addKeyword(input.value);
      }
    });

    addButton.addEventListener('click', () => {
      this.addKeyword(input.value);
    });

    keywordList.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-keyword')) {
        this.removeKeyword(e.target.dataset.keyword);
      }
    });
  }

  async addKeyword(keyword) {
    keyword = keyword.trim().toLowerCase();
    if (!keyword) return;

    if (!this.categories.distraction.keywords.includes(keyword)) {
      this.categories.distraction.keywords.push(keyword);
      await this.saveAndUpdate();
      this.renderCategories();
    }
  }

  async removeKeyword(keyword) {
    this.categories.distraction.keywords = this.categories.distraction.keywords
        .filter(k => k !== keyword);
    await this.saveAndUpdate();
    this.renderCategories();
  }

  setupEventListeners() {
    this.container.addEventListener('change', async (e) => {
      if (e.target.type === 'checkbox') {
        const categoryName = e.target.id;
        const isChecked = e.target.checked;

        if (categoryName === 'everything' && isChecked) {
          this.categories.distraction.enabled = false;
        }

        this.categories[categoryName].enabled = isChecked;
        await this.saveAndUpdate();
      }
    });
  }

  async saveAndUpdate() {
    try {
      this.isUpdating = true;
      await chrome.storage.sync.set({ categories: this.categories });
      await this.updateTabs();
      this.showNotification('Settings updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('Failed to update settings', 'error');
    } finally {
      this.isUpdating = false;
      this.renderCategories();
    }
  }

  async updateTabs() {
    await chrome.runtime.sendMessage({
      type: 'settingsUpdated',
      settings: this.categories
    });
  }

  showNotification(message, type) {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupManager();
  popup.init().catch(error => {
    console.error('Failed to initialize popup:', error);
  });
});