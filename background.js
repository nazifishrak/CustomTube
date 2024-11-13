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
        // Immediately acknowledge receipt of the message
        sendResponse({ status: 'processing' });

        // Find and update YouTube tabs
        chrome.tabs.query({ url: 'https://www.youtube.com/*' }, function(tabs) {
            if (!tabs || tabs.length === 0) {
                console.log('No YouTube tabs found to update');
                return;
            }

            tabs.forEach(function(tab) {
                chrome.tabs.sendMessage(
                    tab.id,
                    { type: 'settingsUpdated', timestamp: Date.now() },
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.warn(`Error updating tab ${tab.id}:`, chrome.runtime.lastError.message);
                        } else {
                            console.log(`Successfully updated tab ${tab.id}`);
                        }
                    }
                );
            });
        });

        return true; // Keep message channel open
    }
});