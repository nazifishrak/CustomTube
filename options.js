const DEFAULT_CATEGORIES = {
    entertainment: {
      enabled: false,
      keywords: ["movie", "music", "trailer", "comedy", "show", "series", "episode", "dance", "concert", "artist"]
    },
    politics: {
      enabled: false,
      keywords: ["election", "senate", "government", "policy", "debate", "campaign", "law", "vote", "congress", "minister"]
    },
    technology: {
      enabled: false,
      keywords: ["tech", "gadgets", "review", "software", "hardware", "AI", "machine learning", "programming", "coding", "development"]
    },
    sports: {
      enabled: false,
      keywords: ["football", "basketball", "soccer", "cricket", "tennis", "match", "tournament", "player", "score", "league"]
    }
  };
  
  class OptionsManager {
    constructor() {
      this.categories = {};
      this.init();
    }
  
    async init() {
      await this.loadSettings();
      this.renderCategories();
      this.setupEventListeners();
    }
  
    async loadSettings() {
      const result = await chrome.storage.sync.get(['categories']);
      this.categories = result.categories || DEFAULT_CATEGORIES;
    }
  
    renderCategories() {
      const container = document.getElementById('categories');
      container.innerHTML = '';
  
      Object.entries(this.categories).forEach(([name, category]) => {
        const div = document.createElement('div');
        div.className = 'category';
        div.innerHTML = `
          <div class="category-header">
            <input type="checkbox" id="${name}-toggle" ${category.enabled ? 'checked' : ''}>
            <label for="${name}-toggle">${name.charAt(0).toUpperCase() + name.slice(1)}</label>
          </div>
          <div class="keyword-input-container">
            <input type="text" 
                   class="keyword-input" 
                   id="keyword-input-${name}" 
                   placeholder="Add new keyword for ${name}"
                   data-category="${name}">
            <button class="add-keyword-btn" data-category="${name}">Add</button>
          </div>
          <div class="keyword-list" id="keywords-${name}"></div>
        `;
        container.appendChild(div);
  
        // Render keywords for this category
        this.renderKeywords(name);
  
        // Add event listeners for this category
        this.setupCategoryEventListeners(name);
      });
    }
  
    renderKeywords(categoryName) {
      const container = document.getElementById(`keywords-${categoryName}`);
      container.innerHTML = '';
  
      this.categories[categoryName].keywords.forEach(keyword => {
        const tag = document.createElement('div');
        tag.className = 'keyword-tag';
        tag.innerHTML = `
          <span>${keyword}</span>
          <button class="remove-keyword" data-category="${categoryName}" data-keyword="${keyword}">×</button>
        `;
        container.appendChild(tag);
      });
    }
  
    setupCategoryEventListeners(categoryName) {
      // Toggle checkbox listener
      const toggle = document.getElementById(`${categoryName}-toggle`);
      toggle.addEventListener('change', (e) => {
        this.categories[categoryName].enabled = e.target.checked;
      });
  
      // Add keyword button listener
      const addBtn = document.querySelector(`button[data-category="${categoryName}"]`);
      const input = document.getElementById(`keyword-input-${categoryName}`);
  
      const addKeyword = () => {
        const keyword = input.value.trim().toLowerCase();
        if (keyword && !this.categories[categoryName].keywords.includes(keyword)) {
          this.categories[categoryName].keywords.push(keyword);
          this.renderKeywords(categoryName);
          input.value = '';
          this.showNotification('Keyword added successfully!', 'success');
        }
      };
  
      addBtn.addEventListener('click', addKeyword);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addKeyword();
        }
      });
  
      // Remove keyword listeners
      const keywordsList = document.getElementById(`keywords-${categoryName}`);
      keywordsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-keyword')) {
          const keyword = e.target.dataset.keyword;
          this.categories[categoryName].keywords = this.categories[categoryName].keywords
            .filter(k => k !== keyword);
          this.renderKeywords(categoryName);
          this.showNotification('Keyword removed successfully!', 'success');
        }
      });
    }
  
    setupEventListeners() {
      // Save button
      document.getElementById('save').addEventListener('click', async () => {
        try {
          await chrome.storage.sync.set({ categories: this.categories });
          this.showNotification('Settings saved successfully!', 'success');
        } catch (error) {
          console.error('Error saving settings:', error);
          this.showNotification('Error saving settings!', 'error');
        }
      });
  
      // Reset button
      document.getElementById('reset').addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all settings to default?')) {
          this.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
          await chrome.storage.sync.set({ categories: this.categories });
          this.renderCategories();
          this.showNotification('Settings reset to default!', 'success');
        }
      });
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
  
  // Initialize options manager
  const optionsManager = new OptionsManager();