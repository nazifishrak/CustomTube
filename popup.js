
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
      const result = await chrome.storage.sync.get(['categories']);
      const categories = result.categories || DEFAULT_CATEGORIES;
  
      const container = document.getElementById('categories');
      Object.entries(categories).forEach(([name, category]) => {
        const div = document.createElement('div');
        div.className = 'category';
        div.innerHTML = `
          <input type="checkbox" id="${name}" ${category.enabled ? 'checked' : ''}>
          <label for="${name}">${name.charAt(0).toUpperCase() + name.slice(1)}</label>
        `;
        container.appendChild(div);
  
        // change listener for each checkbox
        document.getElementById(name).addEventListener('change', async (e) => {
          try {
            categories[name].enabled = e.target.checked;
            await chrome.storage.sync.set({ categories });
          } catch (error) {
            console.error('Error saving category state:', error);
          }
        });
      });
  
      // bknd listener in the open full setting
      document.getElementById('openSettings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    } catch (error) {
      console.error('Error initializing popup:', error);
      // Display error message to the user
      document.body.innerHTML = `
        <div style="color: red; padding: 10px;">
          An error occurred. Please try again.
        </div>
      `;
    }
  });
  