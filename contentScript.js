class YouTubeFilter {
    constructor() {
      this.categories = {};
      this.whitelist = { channels: [], videos: [] };
      this.isProcessing = false;
      this.init();
    }
  
    async init() {
      await this.loadSettings();
      this.setupScrollObserver();
      this.setupMutationObserver();
      this.setupMessageListener();
    }
  
    async loadSettings() {
      try {
        const result = await chrome.storage.sync.get(['categories']);
        this.categories = result.categories || {};
        console.log('Settings loaded:', this.categories);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'settingsUpdated') {
          console.log('Settings updated, refiltering content...');
          this.loadSettings().then(() => {
            this.resetFiltering();
            this.filterAllContent();
          });
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
        rootMargin: '50px',
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
  
    resetFiltering() {
      document.querySelectorAll('[data-filtered]').forEach(el => {
        el.removeAttribute('data-filtered');
        el.style.removeProperty('display');
      });
    }
  
    filterAllContent() {
      this.isProcessing = true;
      try {
        const allVideos = document.querySelectorAll(`
          ytd-rich-item-renderer,
          ytd-video-renderer,
          ytd-compact-video-renderer,
          ytd-grid-video-renderer
        `);
        this.processVideos(allVideos);
      } finally {
        this.isProcessing = false;
      }
    }
  
    filterNewContent() {
      this.isProcessing = true;
      try {
        const newVideos = document.querySelectorAll(`
          ytd-rich-item-renderer:not([data-filtered]),
          ytd-video-renderer:not([data-filtered]),
          ytd-compact-video-renderer:not([data-filtered]),
          ytd-grid-video-renderer:not([data-filtered])
        `);
        this.processVideos(newVideos);
      } finally {
        this.isProcessing = false;
      }
    }
  
    processVideos(videos) {
      videos.forEach(video => {
        try {
          video.setAttribute('data-filtered', 'true');
  
          const titleElement = video.querySelector('#video-title');
          const channelElement = video.querySelector('#channel-name yt-formatted-string, #channel-name a');
          
          if (!titleElement) return;
  
          const title = titleElement.textContent || '';
          const channel = channelElement?.textContent || '';
          const contentText = `${title} ${channel}`.toLowerCase();
  
          if (this.shouldHideContent(contentText)) {
            this.hideElement(video);
          } else {
            this.showElement(video);
          }
        } catch (error) {
          console.error('Error processing video:', error);
        }
      });
    }
  
    shouldHideContent(contentText) {
      for (const [categoryName, category] of Object.entries(this.categories)) {
        if (!category.enabled) continue;
        
        for (const keyword of category.keywords) {
          if (contentText.includes(keyword.toLowerCase())) {
            console.log(`Hiding content matching keyword "${keyword}" in category "${categoryName}"`);
            return true;
          }
        }
      }
      return false;
    }
  
    hideElement(element) {
      if (element && element.style) {
        element.style.setProperty('display', 'none', 'important');
      }
    }
  
    showElement(element) {
      if (element && element.style) {
        element.style.removeProperty('display');
      }
    }
  
    debounce(func, wait) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  }
  

  const youtubeFilter = new YouTubeFilter();
  