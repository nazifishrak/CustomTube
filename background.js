const DEFAULT_SETTINGS = {
    distraction: {
        enabled: false,
        threshold: 0.6,
        keywords: ['entertainment', 'game', 'fun', 'meme', 'reaction', 'prank', 'challenge',
            'viral', 'trending', 'funny', 'comedy', 'vlog', 'gaming', 'minecraft',
            'fortnite', 'reaction', 'compilation', 'drama', 'gossip', 'celebrity']
    },
    everything: {
        enabled: false,
        threshold: 0.1,
        keywords: ['*']
    }
};

// Listen for installation
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const result = await chrome.storage.sync.get(['categories']);
        if (!result.categories) {
            await chrome.storage.sync.set({ categories: DEFAULT_SETTINGS });
            console.log('Initialized default settings');
        }
    } catch (error) {
        console.error('Error initializing settings:', error);
    }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsUpdated') {
        // Broadcast to all YouTube tabs
        chrome.tabs.query({ url: 'https://www.youtube.com/*' }, async (tabs) => {
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'settingsUpdated',
                        timestamp: Date.now()
                    });
                    console.log(`Updated tab ${tab.id}`);
                } catch (error) {
                    console.error(`Error updating tab ${tab.id}:`, error);
                }
            }
            sendResponse({ status: 'success' });
        });
        return true; // Keep message channel open
    }
});