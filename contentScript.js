class ContentFilter {
  constructor() {
    this.categories = {};
    this.debug = true;
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
      /* Hide Shorts section and button */
      ytd-reel-shelf-renderer,
      ytd-guide-entry-renderer[title="Shorts"],
      ytd-mini-guide-entry-renderer[aria-label="Shorts"],
      ytd-guide-entry-renderer a[title="Shorts"],
      ytd-mini-guide-entry-renderer a[aria-label="Shorts"],
      ytd-rich-shelf-renderer[is-shorts] {
        display: none !important;
      }
      /* Everything mode styles */
      body.everything-mode ytd-browse[page-subtype="home"] #contents,
      body.everything-mode ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
      body.everything-mode ytd-browse[page-subtype="home"] ytd-shelf-renderer,
      body.everything-mode ytd-watch-next-secondary-results-renderer {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ping') {
        sendResponse({ status: 'ready' });
        return;
      }

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

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['categories']);
      this.categories = result.categories || {};
      console.log('Loaded filter settings:', this.categories);

      if (this.categories.everything?.enabled) {
        this.handleEverythingMode(true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.categories = {};
    }
  }

  setupScrollObserver() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (this.isProcessing || (this.categories.everything?.enabled && window.location.pathname === '/')) return;

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

      this.removeShorts();
      this.filterNewContent();
    }, 100));

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href']
    });
  }

  removeShorts() {
    const shortsElements = document.querySelectorAll(`
      ytd-reel-shelf-renderer,
      ytd-guide-entry-renderer[title="Shorts"],
      ytd-mini-guide-entry-renderer[aria-label="Shorts"],
      ytd-guide-entry-renderer a[title="Shorts"],
      ytd-mini-guide-entry-renderer a[aria-label="Shorts"],
      ytd-rich-shelf-renderer[is-shorts]
    `);

    shortsElements.forEach(el => el.remove());
  }

  handleEverythingMode(enabled) {
    if (enabled) {
      document.body.classList.add('everything-mode');
    } else {
      document.body.classList.remove('everything-mode');
    }
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
      this.removeShorts();

      if (this.categories.everything?.enabled) {
        this.handleEverythingMode(true);

        // Only process videos if not on homepage
        if (window.location.pathname !== '/') {
          this.processVideos(this.getAllVideos());
        }
      } else {
        this.handleEverythingMode(false);
        this.processVideos(this.getAllVideos());
      }
    } catch (error) {
      console.error('Error during filtering:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  getAllVideos() {
    return Array.from(document.querySelectorAll(`
      ytd-rich-item-renderer:not([is-shorts]),
      ytd-video-renderer:not([is-shorts]),
      ytd-compact-video-renderer:not([is-shorts]),
      ytd-grid-video-renderer:not([is-shorts])
    `));
  }

  filterNewContent() {
    if (!this.initialized) return;

    // Don't process new content in everything mode if on homepage
    if (this.categories.everything?.enabled && window.location.pathname === '/') return;

    this.isProcessing = true;
    try {
      this.removeShorts();

      const newVideos = document.querySelectorAll(`
        ytd-rich-item-renderer:not([data-filtered]):not([is-shorts]),
        ytd-video-renderer:not([data-filtered]):not([is-shorts]),
        ytd-compact-video-renderer:not([data-filtered]):not([is-shorts]),
        ytd-grid-video-renderer:not([data-filtered]):not([is-shorts])
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
    if (this.categories.everything?.enabled && window.location.pathname === '/') return;

    videos.forEach(video => {
      try {
        if (video.hasAttribute('data-filtered')) return;

        const titleElement = video.querySelector('#video-title, .title');
        if (!titleElement) return;

        const title = titleElement.textContent?.trim() || '';
        let shouldHide = false;

        if (this.categories.distraction?.enabled) {
          shouldHide = this.checkForDistraction(title);
        }

        if (shouldHide) {
          this.hideElement(video);
        } else {
          this.showElement(video);
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

  hideElement(element) {
    if (!element) return;
    element.classList.add('filtered-content');
  }

  showElement(element) {
    if (!element) return;
    element.classList.remove('filtered-content');
  }

  resetFiltering() {
    console.log('Resetting all filtered content...');
    this.handleEverythingMode(false);
    document.querySelectorAll('[data-filtered]').forEach(el => {
      el.removeAttribute('data-filtered');
      this.showElement(el);
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