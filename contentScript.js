class YouTubeFilter {
    constructor() {
      this.categories = {};
      this.whitelist = { channels: [], videos: [] };
      this.debug = true;
      this.isProcessing = false;
      this.init();
    }
  
    async init() {
      await this.loadSettings();
      this.setupScrollObserver();
      this.setupMutationObserver();
      this.setupMessageListener();
    }
  
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      // Create an intersection observer to detect when new content comes into view
      this.intersectionObserver = new IntersectionObserver((entries) => {
        if (this.isProcessing) return;
        
        const hasNewContent = entries.some(entry => entry.isIntersecting);
        if (hasNewContent) {
          this.filterNewContent();
        }
      }, {
        root: null,
        rootMargin: '50px', // Start loading a bit before items come into view
        threshold: 0.1
      });
  
      // Observe all potential content containers
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
  
    async loadSettings() {
      try {
        const result = await chrome.storage.sync.get(['categories', 'whitelist']);
        this.categories = result.categories || DEFAULT_CATEGORIES;
        this.whitelist = result.whitelist || { channels: [], videos: [] };
        console.log('Settings loaded:', this.categories);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  
    resetFiltering() {
      // Remove all filtering marks and show all videos
      document.querySelectorAll('[data-filtered]').forEach(el => {
        el.removeAttribute('data-filtered');
        el.style.removeProperty('display');
      });
    }
  
    filterAllContent() {
      // Filter all content, including already filtered items
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
      // Only filter content that hasn't been processed yet
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
          // Mark as processed
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
      if (!element || !element.style) return;
      element.style.setProperty('display', 'none', 'important');
    }
  
    showElement(element) {
      if (!element || !element.style) return;
      element.style.removeProperty('display');
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
  

  window.youtubeFilter = youtubeFilter;