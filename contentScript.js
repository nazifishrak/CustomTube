class YouTubeFilter {
    constructor() {
      this.categories = {};
      this.whitelist = { channels: [], videos: [] };
      this.classifier = new SemanticClassifier();
      this.cache = new Map();
      this.debug = true;
      this.isProcessing = false;
      this.init();
    }
  
    async init() {
      try {
        await Promise.all([
          this.loadSettings(),
          this.classifier.init()
        ]);
        this.setupScrollObserver();
        this.setupMutationObserver();
        this.setupMessageListener();
        this.addStyles();
        console.log('YouTube Filter initialized successfully');
      } catch (error) {
        console.error('Error initializing YouTube Filter:', error);
      }
    }
  
    addStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .category-badges {
          position: absolute;
          top: 4px;
          right: 4px;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          z-index: 2;
          pointer-events: none;
        }
        .category-badge {
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          backdrop-filter: blur(2px);
          transition: opacity 0.2s ease;
        }
        .category-badge[data-confidence="high"] {
          background-color: rgba(220, 53, 69, 0.8);
        }
        .category-badge[data-confidence="medium"] {
          background-color: rgba(255, 193, 7, 0.8);
        }
        .category-badge[data-confidence="low"] {
          background-color: rgba(40, 167, 69, 0.8);
        }
      `;
      document.head.appendChild(style);
    }
  
    setupMessageListener() {
      chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.type === 'settingsUpdated') {
          console.log('Settings updated, refiltering content...');
          await this.loadSettings();
          this.resetFiltering();
          this.filterAllContent();
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
  
    async loadSettings() {
      try {
        const result = await chrome.storage.sync.get(['categories', 'whitelist']);
        this.categories = result.categories || {};
        this.whitelist = result.whitelist || { channels: [], videos: [] };
        console.log('Settings loaded:', this.categories);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  
    resetFiltering() {
      document.querySelectorAll('[data-filtered]').forEach(el => {
        el.removeAttribute('data-filtered');
        el.style.removeProperty('display');
        el.querySelectorAll('.category-badges').forEach(badge => badge.remove());
      });
      this.cache.clear();
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
      if (!this.classifier.ready) {
        console.warn('Classifier not ready, retrying in 100ms...');
        setTimeout(() => this.processVideos(videos), 100);
        return;
      }
  
      videos.forEach(video => {
        try {
          video.setAttribute('data-filtered', 'true');
  
          const titleElement = video.querySelector('#video-title');
          const channelElement = video.querySelector('#channel-name yt-formatted-string, #channel-name a');
          const descriptionElement = video.querySelector('#description-text');
          
          if (!titleElement) return;
  
          const title = titleElement.textContent || '';
          const channel = channelElement?.textContent || '';
          const description = descriptionElement?.textContent || '';
          const contentText = `${title} ${channel} ${description}`.trim();
          
          // Check whitelist first
          const videoId = this.extractVideoId(video);
          if (this.isWhitelisted(channel, videoId)) {
            this.showElement(video);
            return;
          }
  
          // Get or compute classifications
          let classifications;
          if (this.cache.has(contentText)) {
            classifications = this.cache.get(contentText);
          } else {
            classifications = this.classifier.classifyContent(contentText);
            this.cache.set(contentText, classifications);
          }
  
          // Add visual indicators
          this.addClassificationBadges(video, classifications);
  
          // Apply filtering
          if (this.shouldHideContent(classifications)) {
            this.hideElement(video);
          } else {
            this.showElement(video);
          }
        } catch (error) {
          console.error('Error processing video:', error);
        }
      });
    }
  
    addClassificationBadges(video, classifications) {
      // Remove existing badges
      video.querySelectorAll('.category-badges').forEach(badge => badge.remove());
  
      // Create badge container
      let badgeContainer = document.createElement('div');
      badgeContainer.className = 'category-badges';
      
      // Add thumbnail container positioning if needed
      const thumbnailContainer = video.querySelector('#thumbnail');
      if (thumbnailContainer) {
        thumbnailContainer.style.position = 'relative';
        thumbnailContainer.appendChild(badgeContainer);
      } else {
        video.style.position = 'relative';
        video.appendChild(badgeContainer);
      }
  
      // Add badges for each classification
      classifications.forEach(({ category, confidence }) => {
        const badge = document.createElement('div');
        badge.className = 'category-badge';
        badge.textContent = this.formatCategoryName(category);
        
        // Add confidence level
        let confidenceLevel = 'low';
        if (confidence > 0.8) confidenceLevel = 'high';
        else if (confidence > 0.7) confidenceLevel = 'medium';
        
        badge.setAttribute('data-confidence', confidenceLevel);
        badge.title = `Confidence: ${Math.round(confidence * 100)}%`;
        
        badgeContainer.appendChild(badge);
      });
    }
  
    formatCategoryName(category) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  
    shouldHideContent(classifications) {
      return classifications.some(({ category, confidence }) => 
        this.categories[category]?.enabled && confidence >= (this.categories[category].threshold || 0.6)
      );
    }
  
    isWhitelisted(channel, videoId) {
      return (
        this.whitelist.channels.some(c => c.toLowerCase() === channel.toLowerCase()) ||
        (videoId && this.whitelist.videos.includes(videoId))
      );
    }
  
    extractVideoId(videoElement) {
      const link = videoElement.querySelector('a#thumbnail');
      if (!link) return null;
      
      const href = link.href;
      const match = href.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
      return match ? match[1] : null;
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
  
  // Initialize the filter
  const youtubeFilter = new YouTubeFilter();
  
  // Make it accessible for debugging
  window.youtubeFilter = youtubeFilter;