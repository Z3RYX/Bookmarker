document.addEventListener('DOMContentLoaded', () => {
  const priorityButtons = document.querySelectorAll('#priority-buttons button'); // Buttons to set bookmark priority
  const bookmarkList = document.getElementById('bookmark-list'); // Container for displaying bookmarks
  const modal = document.getElementById('edit-modal'); // Modal for editing bookmarks
  const editTitleInput = document.getElementById('edit-title'); // Input field for editing bookmark title
  const editPrioritySelect = document.getElementById('edit-priority'); // Dropdown to edit bookmark priority
  const saveEditButton = document.getElementById('save-edit'); // Button to save edits
  const cancelEditButton = document.getElementById('cancel-edit'); // Button to cancel edits

  let editingUUID = null; // Stores the UUID of the bookmark being edited

  // Function to generate a unique identifier for each bookmark
  function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }
  
  // Add an icon to the top right of the popup
  const icon = document.createElement('img');
  icon.src = 'images/icon-128.png'; // Path to the 128x128 icon
  icon.alt = 'Bookmarker Icon';
  icon.style.position = 'absolute';
  icon.style.top = '10px';
  icon.style.right = '10px';
  icon.style.width = '40px'; // Adjust size as needed
  icon.style.height = '40px'; // Adjust size as needed
  icon.style.borderRadius = '100%'; // Gives it rounded borders
  document.body.appendChild(icon);

  // Add event listeners to priority buttons
  priorityButtons.forEach(button => {
    button.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0]; // Get the current active tab
        const bookmark = {
          id: generateUUID(), // Assign a unique ID to the bookmark
          url: tab.url,
          title: tab.title,
          priority: parseInt(button.dataset.priority), // Set priority based on button clicked
          addedAt: Date.now(), // Timestamp when the bookmark was added
          visited: false // Indicates whether the bookmark has been visited
        };
        chrome.storage.local.get({ bookmarks: [] }, (data) => {
          data.bookmarks.push(bookmark); // Add the new bookmark to storage
          chrome.storage.local.set({ bookmarks: data.bookmarks }, renderBookmarks); // Update the bookmark list
        });
      });
    });
  });

  // Function to render the bookmark list
  function renderBookmarks() {
    chrome.storage.local.get({ bookmarks: [] }, (data) => {
      const sortedBookmarks = data.bookmarks.sort((a, b) => {
        if (a.visited !== b.visited) return b.visited - a.visited; // Sort visited bookmarks last
        const priorityDiff = b.priority - a.priority; // Sort by priority (higher first)
        return priorityDiff || a.addedAt - b.addedAt; // Sort by timestamp if priorities match
      });

      bookmarkList.innerHTML = ''; // Clear the current list
      sortedBookmarks.forEach((bookmark) => {
        const entryDiv = document.createElement('div');
        if (bookmark.visited) entryDiv.classList.add('visited'); // Highlight visited bookmarks

        let entryTitle = bookmark.title.length > 64 ? bookmark.title.slice(0, 64) + "..." : bookmark.title; // Shorten long titles
        entryTitle = entryTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Escape HTML characters

        const header = document.createElement('div');
        header.className = 'entry-header'; // Header containing title and controls
        header.innerHTML = `<span>${entryTitle}</span>`;

        const editBtn = document.createElement('div');
        editBtn.textContent = '✎';
        editBtn.className = 'edit-button btn';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent click event from propagating
          editingUUID = bookmark.id; // Set the UUID of the bookmark being edited
          editTitleInput.value = bookmark.title; // Pre-fill the title input
          editPrioritySelect.value = bookmark.priority; // Pre-select the priority
          modal.classList.remove('hidden'); // Show the modal
        });

        const deleteBtn = document.createElement('div');
        deleteBtn.textContent = '🗑';
        deleteBtn.className = 'delete-button btn';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          data.bookmarks = data.bookmarks.filter(b => b.id !== bookmark.id); // Remove the bookmark
          chrome.storage.local.set({ bookmarks: data.bookmarks }, renderBookmarks); // Update the list
        });

        const btns = document.createElement('div'); // Container for edit and delete buttons
        btns.appendChild(editBtn);
        btns.appendChild(deleteBtn);

        header.appendChild(btns);

        const controls = document.createElement('div');
        controls.className = 'entry-controls'; // Controls showing priority, site, and age
        controls.innerHTML = `<span class="stars stars-${bookmark.priority}">${'★'.repeat(bookmark.priority)}${'☆'.repeat(5 - bookmark.priority)}</span>
                              <span class="site">${bookmark.url.split('/')[2]}</span>
                              <span class="age">${formatTimeAgo(bookmark.addedAt)}</span>`;

        entryDiv.appendChild(header);
        entryDiv.appendChild(controls);
		
		// Add click event to open the URL and mark it as visited
		entryDiv.addEventListener('click', () => {
		  chrome.tabs.create({ url: bookmark.url }); // Open the URL in a new tab
		  chrome.storage.local.get({ bookmarks: [] }, (data) => {
			const updatedBookmarks = data.bookmarks.map(b => {
			  if (b.id === bookmark.id) {
				b.visited = true; // Mark as visited
			  }
			  return b;
			});
			chrome.storage.local.set({ bookmarks: updatedBookmarks }, renderBookmarks); // Update and re-render
		  });
		});

		
        bookmarkList.appendChild(entryDiv); // Add the bookmark to the list
      });
    });
  }

  // Save changes to a bookmark
  saveEditButton.addEventListener('click', () => {
    chrome.storage.local.get({ bookmarks: [] }, (data) => {
      const bookmark = data.bookmarks.find(b => b.id === editingUUID); // Find the bookmark by UUID
      if (bookmark) {
        bookmark.title = editTitleInput.value ? editTitleInput.value : bookmark.title; // Update the title
        bookmark.priority = parseInt(editPrioritySelect.value); // Update the priority
        bookmark.visited = false; // Reset visited status
        chrome.storage.local.set({ bookmarks: data.bookmarks }, () => {
          modal.classList.add('hidden'); // Hide the modal
          renderBookmarks(); // Re-render the list
        });
      }
    });
  });

  // Cancel editing a bookmark
  cancelEditButton.addEventListener('click', () => {
    modal.classList.add('hidden'); // Hide the modal
  });

  // Format timestamps into a human-readable "time ago" format
  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} sec ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  renderBookmarks(); // Initial render of the bookmarks
});
