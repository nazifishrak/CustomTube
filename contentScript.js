class ContentFilter {
  constructor() {
    this.categories = {};
    this.debug = false;
    this.isProcessing = false;
    this.initialized = false;
    this.initializeFilter();
  }

  async initializeFilter() {
    try {
      console.log('Starting Content Filter initialization...');
      await this.loadSettings();

      this.setupScrollObserver();
      this.setupMutationObserver();
      this.setupMessageListener();
      this.addStyles();

      this.initialized = true;
      console.log('Content Filter initialized with settings:', this.categories);

      // Initial content filtering
      this.filterAllContent();
    } catch (error) {
      console.error('Error initializing Content Filter:', error);
    }
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .filtered-content {
        display: none !important;
      }
      .category-label {
        position: absolute;
        top: 4px;
        right: 4px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 2;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['categories']);
      this.categories = result.categories || {};
      console.log('Loaded filter settings:', this.categories);
    } catch (error) {
      console.error('Error loading settings:', error);
      this.categories = {};
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'settingsUpdated') {
        console.log('Received settings update');
        this.handleSettingsUpdate()
            .then(() => sendResponse({ status: 'success' }))
            .catch(error => {
              console.error('Settings update failed:', error);
              sendResponse({ status: 'error', error: error.message });
            });
        return true;
      }
    });
  }

  setupScrollObserver() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (this.isProcessing) return;

      const hasNewContent = entries.some(entry => entry.isIntersecting);
      if (hasNewContent) {
        this.filterNewContent();
      }
    }, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    const containers = document.querySelectorAll('#contents, ytd-rich-grid-renderer');
    containers.forEach(container => {
      if (container) this.intersectionObserver.observe(container);
    });
  }

  setupMutationObserver() {
    this.mutationObserver = new MutationObserver(this.debounce(() => {
      if (this.isProcessing) return;
      this.filterNewContent();
    }, 100));

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href']
    });
  }

  async handleSettingsUpdate() {
    console.log('Handling settings update...');
    await this.loadSettings();
    await this.refilterContent();
    console.log('Settings update complete');
  }

  filterAllContent() {
    this.isProcessing = true;
    try {
      console.log('Filtering all content...');
      const allVideos = document.querySelectorAll(`
        ytd-rich-item-renderer,
        ytd-video-renderer,
        ytd-compact-video-renderer,
        ytd-grid-video-renderer
      `);
      console.log(`Found ${allVideos.length} videos to process`);
      this.processVideos(Array.from(allVideos));
    } catch (error) {
      console.error('Error during filtering:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  filterNewContent() {
    if (!this.initialized) return;

    this.isProcessing = true;
    try {
      const newVideos = document.querySelectorAll(`
        ytd-rich-item-renderer:not([data-filtered]),
        ytd-video-renderer:not([data-filtered]),
        ytd-compact-video-renderer:not([data-filtered]),
        ytd-grid-video-renderer:not([data-filtered])
      `);
      if (newVideos.length > 0) {
        console.log(`Processing ${newVideos.length} new videos`);
        this.processVideos(Array.from(newVideos));
      }
    } catch (error) {
      console.error('Error processing new content:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  processVideos(videos) {
    videos.forEach(video => {
      try {
        if (video.hasAttribute('data-filtered')) return;

        const titleElement = video.querySelector('#video-title, .title');
        if (!titleElement) return;

        const title = titleElement.textContent?.trim() || '';

        // Check if "everything" category is enabled
        if (this.categories.everything?.enabled) {
          this.hideElement(video);
          this.addLabel(video, 'Blocked');
          video.setAttribute('data-filtered', 'true');
          return;
        }

        // Check for distractions if enabled
        if (this.categories.distraction?.enabled) {
          const isDistraction = this.checkForDistraction(title);
          if (isDistraction) {
            this.hideElement(video);
            this.addLabel(video, 'Distraction');
          }
        }

        video.setAttribute('data-filtered', 'true');
      } catch (error) {
        console.error('Error processing video:', error);
      }
    });
  }

  checkForDistraction(text) {
    const keywords = this.categories.distraction?.keywords || [];
    const textLower = text.toLowerCase();
    return keywords.some(keyword => textLower.includes(keyword.toLowerCase()));
  }

  addLabel(element, text) {
    const thumbnailContainer = element.querySelector('#thumbnail');
    if (thumbnailContainer) {
      thumbnailContainer.style.position = 'relative';
      const label = document.createElement('div');
      label.className = 'category-label';
      label.textContent = text;
      thumbnailContainer.appendChild(label);
    }
  }

  hideElement(element) {
    if (!element?.style) return;
    element.classList.add('filtered-content');
  }

  showElement(element) {
    if (!element?.style) return;
    element.classList.remove('filtered-content');
  }

  resetFiltering() {
    console.log('Resetting all filtered content...');
    document.querySelectorAll('[data-filtered]').forEach(el => {
      el.removeAttribute('data-filtered');
      this.showElement(el);
      el.querySelectorAll('.category-label').forEach(label => label.remove());
    });
  }

  async refilterContent() {
    console.log('Refiltering all content...');
    this.resetFiltering();
    await this.filterAllContent();
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

// Initialize filter
const contentFilter = new ContentFilter();