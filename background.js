const DEFAULT_SETTINGS = {
    distraction: {
        enabled: false,
        threshold: 0.6,
        keywords: [ // Entertainment keywords
            "entertainment", "celebrity", "gossip", "viral", "funny", "comedy", "meme",
            "challenge", "reaction", "reacts", "prank", "drama", "tv", "music", "movie",
            "dance", "cover", "gaming", "minecraft", "fortnite", "trending", "vlog",
            "fun", "unboxing", "reviewing", "ranking", "exploring", "commenting", "parody",
            "america","us", "canada", "tax",

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

chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggle-extension") {
        try {
            // Get current settings
            const result = await chrome.storage.sync.get(['categories']);
            const settings = result.categories || DEFAULT_SETTINGS;
            
            // Toggle both filters
            settings.distraction.enabled = !settings.distraction.enabled;
            settings.everything.enabled = !settings.everything.enabled;
            
            // Save updated settings
            await chrome.storage.sync.set({ categories: settings });
            
            // Notify that settings were updated
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'settingsUpdated',
                    settings: settings
                });
            });
            
            // Optional: Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: 'CustomTube',
                message: `Filtering ${settings.distraction.enabled ? 'enabled' : 'disabled'}`
            });
        } catch (error) {
            console.error('Error toggling extension:', error);
        }
    }
});

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