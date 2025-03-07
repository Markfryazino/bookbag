// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const paperDetails = document.getElementById('paper-details');
  const noPaperMessage = document.getElementById('no-paper-message');
  const paperTitle = document.getElementById('paper-title');
  const paperAuthors = document.getElementById('paper-authors');
  const paperNotes = document.getElementById('paper-notes');
  const paperTags = document.getElementById('paper-tags');
  const savePaperBtn = document.getElementById('save-paper-btn');
  const paperList = document.getElementById('paper-list');
  const emptyLibraryMessage = document.getElementById('empty-library-message');
  const searchInput = document.getElementById('search-input');
  const notification = document.getElementById('notification');

  let currentPaperInfo = null;
  let allPapers = [];

  // Set Library as the default active tab
  switchToLibraryTab();

  // Tab switching functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanel = tab.getAttribute('data-panel');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active panel
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === targetPanel) {
          panel.classList.add('active');
          
          // Refresh library if switching to library tab
          if (targetPanel === 'library-panel') {
            loadPapers();
          }
        }
      });
    });
  });

  // Function to switch to library tab
  function switchToLibraryTab() {
    // Update tabs
    tabs.forEach(t => {
      if (t.getAttribute('data-panel') === 'library-panel') {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    
    // Update panels
    panels.forEach(panel => {
      if (panel.id === 'library-panel') {
        panel.classList.add('active');
        loadPapers(); // Load papers when showing library
      } else {
        panel.classList.remove('active');
      }
    });
  }

  // Check if current page is an arXiv page
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0];
    if (activeTab.url.includes('arxiv.org')) {
      // Get paper info from content script
      chrome.tabs.sendMessage(activeTab.id, { action: "getPaperInfo" }, response => {
        if (response && response.title) {
          chrome.runtime.sendMessage({ action: "getPapers" }, libraryResponse => {
            // Enhanced paper matching logic that handles undefined arxivId
            let existingPaper = null;
            
            // First try to match by arxivId if available
            if (response.arxivId) {
              existingPaper = libraryResponse.papers.find(p => p.arxivId === response.arxivId);
            }
            
            // If no match by arxivId, try to match by title (as a fallback)
            if (!existingPaper && response.title) {
              existingPaper = libraryResponse.papers.find(p => 
                p.title.toLowerCase().trim() === response.title.toLowerCase().trim()
              );
            }
      
            // Preserve current page's metadata while merging existing notes/tags
            currentPaperInfo = {
              ...response, // Current page's fresh metadata
              ...(existingPaper && { 
                id: existingPaper.id,
                notes: existingPaper.notes,
                tags: existingPaper.tags,
                // Preserve existing citation if needed
                citation: existingPaper.citation || response.citation
              })
            };
      
            // Update UI elements
            paperTitle.textContent = currentPaperInfo.title; // Always use current title
            paperAuthors.textContent = currentPaperInfo.authors; // Always use current authors
            paperNotes.value = existingPaper?.notes || '';
            paperTags.value = existingPaper?.tags?.join(', ') || '';
            savePaperBtn.textContent = existingPaper ? 'Update Paper' : 'Save Paper';
      
            noPaperMessage.style.display = 'none';
            paperDetails.style.display = 'block';
          });
        } else {
          noPaperMessage.style.display = 'block';
          paperDetails.style.display = 'none';
        }
      });
    } else {
      // Not on an arXiv page
      noPaperMessage.style.display = 'block';
      paperDetails.style.display = 'none';
    }
  });

  // Save paper button click handler
  savePaperBtn.addEventListener('click', () => {
    if (!currentPaperInfo) return;
  
    const notes = paperNotes.value;
    const tags = paperTags.value.split(',').map(tag => tag.trim()).filter(tag => tag);
  
    const isUpdate = !!currentPaperInfo.id;
    
    chrome.runtime.sendMessage({ 
      action: "fetchCitation", 
      title: currentPaperInfo.title 
    }, response => {
      if (response.success) {
        const paperData = {
          ...currentPaperInfo,
          notes,
          tags,
          citation: response.citation
        };
  
        const action = isUpdate ? "updatePaper" : "savePaper";
        
        chrome.runtime.sendMessage({ 
          action: action,
          paperData 
        }, saveResponse => {
          if (saveResponse.success) {
            showNotification(isUpdate ? 'Paper updated!' : 'Paper saved!');
            if (!isUpdate) {
              paperNotes.value = '';
              paperTags.value = '';
            }
            loadPapers(); // Refresh library
          } else {
            showNotification('Error saving paper.');
          }
        });
      } else {
        showNotification('Error fetching citation.');
      }
    });
  });

  // Load papers from storage
  function loadPapers(searchQuery = '') {
    chrome.runtime.sendMessage({ action: "getPapers" }, response => {
      const papers = response.papers || [];
      allPapers = papers;
      
      if (papers.length > 0) {
        emptyLibraryMessage.style.display = 'none';
        renderPaperList(papers, searchQuery);
      } else {
        emptyLibraryMessage.style.display = 'block';
        paperList.innerHTML = '';
        paperList.appendChild(emptyLibraryMessage);
      }
    });
  }

  // Render the paper list
  function renderPaperList(papers, searchQuery = '') {
    // Filter papers if search query exists
    const filteredPapers = searchQuery ? 
      papers.filter(paper => 
        paper.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (paper.notes && paper.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (paper.tags && paper.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      ) : papers;

    // Clear existing list except empty message
    Array.from(paperList.children).forEach(child => {
      if (child !== emptyLibraryMessage) {
        child.remove();
      }
    });
    
    // Hide empty message and sort papers by date added
    if (filteredPapers.length > 0) {
      emptyLibraryMessage.style.display = 'none';
      
      const sortedPapers = filteredPapers.sort((a, b) => {
        return new Date(b.dateAdded) - new Date(a.dateAdded);
      });
      
      // Create paper items
      sortedPapers.forEach(paper => {
        const paperItem = document.createElement('div');
        paperItem.className = 'paper-item';
        paperItem.dataset.id = paper.id;
        
        const paperTitle = document.createElement('div');
        paperTitle.className = 'paper-title';
        paperTitle.textContent = paper.title;
        
        const paperAuthors = document.createElement('div');
        paperAuthors.className = 'paper-authors';
        paperAuthors.textContent = paper.authors;
        
        // Add notes preview if available
        if (paper.notes && paper.notes.trim()) {
          const paperNotesPreview = document.createElement('div');
          paperNotesPreview.className = 'paper-notes-preview';
          
          // Truncate notes if too long
          const maxLength = 100;
          const notesText = paper.notes.length > maxLength 
            ? paper.notes.substring(0, maxLength) + '...' 
            : paper.notes;
            
          paperNotesPreview.textContent = notesText;
          paperItem.appendChild(paperNotesPreview);
        }
        
        const paperTags = document.createElement('div');
        paperTags.className = 'paper-tags';
        
        if (paper.tags && paper.tags.length > 0) {
          paper.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            
            // Special styling for "to read" tag
            if (tag.toLowerCase() === 'to read') {
              tagElement.className += ' tag-to-read';
            }
            
            tagElement.textContent = tag;
            paperTags.appendChild(tagElement);
          });
        }

        // Create actions container
        const paperActions = document.createElement('div');
        paperActions.className = 'paper-actions';
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn secondary';
        deleteButton.innerHTML = '&times;'; // × symbol
        deleteButton.title = 'Delete paper';
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent opening the paper
          deletePaper(paper.id);
        });
        
        paperActions.appendChild(deleteButton);
        
        // NOTE: BibTeX button removed due to compatibility issues
        
        paperItem.appendChild(paperTitle);
        paperItem.appendChild(paperAuthors);
        paperItem.appendChild(paperTags);
        paperItem.appendChild(paperActions);
        
        // Add click handler to view paper details
        paperItem.addEventListener('click', () => {
          // Open PDF URL in new tab
          chrome.tabs.create({ url: paper.pdfUrl || paper.url }, (newTab) => {
            // Wait for the tab to load, then send a message to display notes
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
              if (tabId === newTab.id && changeInfo.status === 'complete') {
                // Tab has finished loading, send message to content script
                chrome.tabs.sendMessage(tabId, { 
                  action: "openSavedPaper", 
                  paperData: paper 
                });
                chrome.tabs.onUpdated.removeListener(listener);
              }
            });
          });
        });
        
        paperList.appendChild(paperItem);
      });
    } else {
      emptyLibraryMessage.style.display = 'block';
      if (searchQuery) {
        emptyLibraryMessage.innerHTML = '<p>No papers found matching your search.</p>';
      } else {
        emptyLibraryMessage.innerHTML = '<p>Your library is empty.</p><p>Save papers to see them here.</p>';
      }
    }
  }

  // Function to delete a paper from storage
  function deletePaper(paperId) {
    // Show confirmation dialog
    if (confirm('Are you sure you want to delete this paper?')) {
      chrome.runtime.sendMessage({ 
        action: "deletePaper", 
        paperId: paperId 
      }, response => {
        if (response.success) {
          showNotification('Paper deleted successfully');
          loadPapers(); // Refresh the paper list
        } else {
          showNotification('Error deleting paper');
        }
      });
    }
  }

  // Handle search input
  searchInput.addEventListener('input', (e) => {
    const searchQuery = e.target.value.trim();
    renderPaperList(allPapers, searchQuery);
  });

  // Show notification
  function showNotification(message) {
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        notification.style.display = 'none';
        notification.style.opacity = '1';
        notification.style.transition = '';
      }, 500);
    }, 3000);
  }

  // Initial load
  loadPapers();
}); 