const DEFAULT_CATEGORIES = {
    entertainment: {
      enabled: false,
      keywords: ["movie", "music", "trailer", "comedy", "show"]
    },
    politics: {
      enabled: false,
      keywords: ["election", "senate", "government", "policy", "debate"]
    },
    technology: {
      enabled: false,
      keywords: ["tech", "gadgets", "review", "software", "hardware"]
    },
    sports: {
      enabled: false,
      keywords: ["football", "basketball", "soccer", "cricket", "tennis"]
    }
  };
  
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Load categories
      const result = await chrome.storage.sync.get(['categories']);
      const categories = result.categories || DEFAULT_CATEGORIES;
  
      // Render categories
      const container = document.getElementById('categories');
      Object.entries(categories).forEach(([name, category]) => {
        const div = document.createElement('div');
        div.className = 'category';
        div.innerHTML = `
          <input type="checkbox" id="${name}" ${category.enabled ? 'checked' : ''}>
          <label for="${name}">${name.charAt(0).toUpperCase() + name.slice(1)}</label>
        `;
        container.appendChild(div);
  
        // Add change listener for each checkbox
        document.getElementById(name).addEventListener('change', async (e) => {
          try {
            categories[name].enabled = e.target.checked;
            await chrome.storage.sync.set({ categories });
            // Notify content script to update filtering
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated' });
            }
          } catch (error) {
            console.error('Error saving category state:', error);
          }
        });
      });
  
      // Add click listener for settings button
      const settingsButton = document.getElementById('openSettings');
      if (settingsButton) {
        settingsButton.addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
        });
      }
    } catch (error) {
      console.error('Error initializing popup:', error);
      // Show error message to user
      document.body.innerHTML = `
        <div style="color: red; padding: 10px;">
          An error occurred. Please try again.
        </div>
      `;
    }
  });