const DEFAULT_CATEGORIES = {
  distraction: {
    enabled: false,
    threshold: 0.6,
    keywords: ['entertainment', 'game', 'fun', 'meme', 'reaction', 'prank', 'challenge',
      'viral', 'trending', 'funny', 'comedy', 'vlog', 'gaming', 'minecraft',
      'fortnite', 'reaction', 'compilation', 'drama', 'gossip', 'celebrity']
  },
  everything: {
    enabled: false,
    threshold: 0.1, // Low threshold since we want to match everything
    keywords: ['*'] // Special keyword to match everything
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
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showNotification('Failed to initialize settings', 'error');
    }
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
        // Add keyword input
        const inputContainer = document.createElement('div');
        inputContainer.className = 'keyword-input-container';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'keyword-input';
        input.placeholder = 'Add new keyword';
        input.id = `keyword-input-${name}`;

        const addButton = document.createElement('button');
        addButton.className = 'add-keyword-btn';
        addButton.textContent = 'Add';
        addButton.dataset.category = name;

        inputContainer.appendChild(input);
        inputContainer.appendChild(addButton);
        div.appendChild(inputContainer);

        // Add keyword list
        const keywordList = document.createElement('div');
        keywordList.className = 'keyword-list';
        keywordList.id = `keywords-${name}`;

        category.keywords.forEach(keyword => {
          const tag = document.createElement('div');
          tag.className = 'keyword-tag';
          tag.innerHTML = `
            <span>${keyword}</span>
            <button class="remove-keyword" data-category="${name}" data-keyword="${keyword}">×</button>
          `;
          keywordList.appendChild(tag);
        });

        div.appendChild(keywordList);
      }

      this.container.appendChild(div);
    });
  }

  setupEventListeners() {
    this.container.addEventListener('change', async (e) => {
      if (e.target.type === 'checkbox' && !this.isUpdating) {
        const categoryName = e.target.id;
        const isChecked = e.target.checked;

        try {
          this.isUpdating = true;
          this.updateCheckboxStates(true);

          // Update local state
          this.categories[categoryName].enabled = isChecked;

          // If "everything" is enabled, disable "distraction"
          if (categoryName === 'everything' && isChecked) {
            this.categories.distraction.enabled = false;
            this.renderCategories();
          }

          // Save to storage and notify content script
          await this.saveSettings();
          await this.notifyContentScript();

          console.log(`Successfully updated ${categoryName} to ${isChecked}`);
          this.showNotification('Settings updated successfully!', 'success');
        } catch (error) {
          console.error('Error updating settings:', error);
          this.categories[categoryName].enabled = !isChecked;
          this.showNotification('Failed to update settings', 'error');
        } finally {
          this.isUpdating = false;
          this.updateCheckboxStates(false);
        }
      }
    });

    // Keyword management listeners
    this.container.addEventListener('click', async (e) => {
      if (e.target.classList.contains('add-keyword-btn')) {
        const categoryName = e.target.dataset.category;
        const input = document.getElementById(`keyword-input-${categoryName}`);
        const keyword = input.value.trim().toLowerCase();

        if (keyword && !this.categories[categoryName].keywords.includes(keyword)) {
          this.categories[categoryName].keywords.push(keyword);
          await this.saveSettings();
          await this.notifyContentScript();
          this.renderCategories();
          input.value = '';
          this.showNotification('Keyword added successfully!', 'success');
        }
      } else if (e.target.classList.contains('remove-keyword')) {
        const { category, keyword } = e.target.dataset;
        this.categories[category].keywords = this.categories[category].keywords
            .filter(k => k !== keyword);
        await this.saveSettings();
        await this.notifyContentScript();
        this.renderCategories();
        this.showNotification('Keyword removed successfully!', 'success');
      }
    });

    // Add keyword on Enter key
    this.container.addEventListener('keypress', async (e) => {
      if (e.target.classList.contains('keyword-input') && e.key === 'Enter') {
        const categoryName = 'distraction'; // Only distraction category has keywords
        const keyword = e.target.value.trim().toLowerCase();

        if (keyword && !this.categories[categoryName].keywords.includes(keyword)) {
          this.categories[categoryName].keywords.push(keyword);
          await this.saveSettings();
          await this.notifyContentScript();
          this.renderCategories();
          e.target.value = '';
          this.showNotification('Keyword added successfully!', 'success');
        }
      }
    });
  }

  updateCheckboxStates(disabled) {
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.disabled = disabled;
    });
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ categories: this.categories });
      console.log('Settings saved:', this.categories);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  async notifyContentScript() {
    try {
      await chrome.runtime.sendMessage({ type: 'settingsUpdated' });
      console.log('Notification sent to background script');
    } catch (error) {
      console.error('Error notifying content script:', error);
      throw new Error('Failed to update filter');
    }
  }

  showNotification(message, type) {
    const notification = document.getElementById('notification');
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