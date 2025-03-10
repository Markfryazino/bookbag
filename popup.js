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
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importInput = document.getElementById('import-input');

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

  // Check current page and get paper info
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0];
    
    // Check if we're on some kind of page we can handle
    const isPDFPage = activeTab.url.endsWith('.pdf') || 
                     (activeTab.url.includes('.pdf?') && !activeTab.url.includes('.pdf.html'));
    const isArxivPage = activeTab.url.includes('arxiv.org');
    
    if (isArxivPage || isPDFPage) {
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
            
            // If no match by arxivId or not an arXiv paper, try to match by URL
            if (!existingPaper && response.url) {
              existingPaper = libraryResponse.papers.find(p => 
                p.url === response.url || p.pdfUrl === response.url);
            }
            
            // If still no match, try to match by title (as a fallback)
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
                notes: existingPaper.notes || '',
                tags: existingPaper.tags || [],
                citation: existingPaper.citation || ''
              })
            };
            
            // Show paper details in the save panel
            showPaperDetails(currentPaperInfo);
            
            // If not an arXiv paper, show a message about editing fields
            if (!response.isArxiv) {
              const editableMessage = document.createElement('div');
              editableMessage.className = 'alert-message';
              editableMessage.textContent = 'This appears to be a generic PDF. Please edit the title and authors as needed.';
              paperDetails.insertBefore(editableMessage, paperDetails.firstChild);
            }
          });
        } else {
          // No paper info available
          noPaperMessage.style.display = 'block';
          paperDetails.style.display = 'none';
        }
      });
    } else {
      // Not on a supported page
      noPaperMessage.style.display = 'block';
      paperDetails.style.display = 'none';
      noPaperMessage.innerHTML = 'This extension works with arXiv papers and PDF files.<br>Visit an arXiv page or open a PDF to save it to your library.';
    }
  });

  // Display paper details in the save panel
  function showPaperDetails(paperInfo) {
    if (!paperInfo) return;
    
    noPaperMessage.style.display = 'none';
    paperDetails.style.display = 'block';
    
    // For non-arXiv papers or if marked as editable, make fields editable
    const isEditable = !paperInfo.isArxiv || paperInfo.isEditable;
    
    if (isEditable) {
      // Create editable title field
      paperTitle.innerHTML = '';
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.id = 'paper-title-input';
      titleInput.className = 'paper-input';
      titleInput.value = paperInfo.title || '';
      paperTitle.appendChild(titleInput);
      
      // Create editable authors field
      paperAuthors.innerHTML = '';
      const authorsInput = document.createElement('input');
      authorsInput.type = 'text';
      authorsInput.id = 'paper-authors-input';
      authorsInput.className = 'paper-input';
      authorsInput.value = paperInfo.authors || '';
      paperAuthors.appendChild(authorsInput);
    } else {
      // Regular display for arXiv papers
      paperTitle.textContent = paperInfo.title || 'No title available';
      paperAuthors.textContent = paperInfo.authors || 'No authors available';
    }
    
    paperNotes.value = paperInfo.notes || '';
    paperTags.value = paperInfo.tags ? paperInfo.tags.join(', ') : '';
    
    // Update the save button text based on whether paper is already saved
    savePaperBtn.textContent = paperInfo.id ? 'Update Paper' : 'Save Paper';
    
    // Set up save button event listener
    savePaperBtn.onclick = function() {
      const notesValue = paperNotes.value;
      const tagsValue = paperTags.value.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      // Get title and authors from input fields if they exist
      let titleValue = paperInfo.title;
      let authorsValue = paperInfo.authors;
      
      if (isEditable) {
        titleValue = document.getElementById('paper-title-input').value.trim();
        authorsValue = document.getElementById('paper-authors-input').value.trim();
      }
      
      // For non-arXiv papers, check that title is provided
      if (isEditable && !titleValue) {
        showNotification('Please provide a title for the paper', true);
        return;
      }
      
      const updatedPaperInfo = {
        ...paperInfo,
        title: titleValue,
        authors: authorsValue,
        notes: notesValue,
        tags: tagsValue
      };
      
      if (paperInfo.id) {
        // Update existing paper
        chrome.runtime.sendMessage({
          action: "updatePaper",
          paperData: updatedPaperInfo
        }, response => {
          if (response && response.success) {
            showNotification('Paper updated successfully');
            currentPaperInfo = updatedPaperInfo;
          } else {
            showNotification('Error updating paper', true);
          }
        });
      } else {
        // Save new paper
        chrome.runtime.sendMessage({
          action: "savePaper",
          paperData: updatedPaperInfo
        }, response => {
          if (response && response.success) {
            showNotification('Paper saved to library');
            currentPaperInfo = { ...updatedPaperInfo, id: response.savedPaper.id };
            savePaperBtn.textContent = 'Update Paper';
            
            // Switch to library tab after saving
            switchToLibraryTab();
          } else {
            showNotification('Error saving paper', true);
          }
        });
      }
    };
  }

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
  function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.style.display = 'block';
    notification.className = isError ? 'error' : '';
    
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

  // Export functionality
  exportBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "getPapers" }, response => {
      const data = JSON.stringify(response.papers, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const dateString = new Date().toISOString().split('T')[0];
      chrome.downloads.download({
        url: url,
        filename: `bookbag-backup-${dateString}.json`,
        conflictAction: 'uniquify'
      });
      
      showNotification(`Exported ${response.papers.length} papers`);
    });
  });

  // Import functionality
  importBtn.addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const papers = JSON.parse(e.target.result);
        if (!Array.isArray(papers)) throw new Error('Invalid format');
        
        // Basic validation
        const isValid = papers.every(p => p.id && p.title && p.url);
        if (!isValid) throw new Error('Invalid paper format');

        if (confirm(`Import ${papers.length} papers? This will overwrite current data!`)) {
          chrome.runtime.sendMessage({ 
            action: "importPapers",
            papers: papers
          }, response => {
            if (response.success) {
              showNotification(`Imported ${papers.length} papers`);
              loadPapers();
            }
          });
        }
      } catch (error) {
        showNotification('Invalid backup file: ' + error.message);
      }
      importInput.value = ''; // Reset input
    };
    reader.readAsText(file);
  });

  // Initial load
  loadPapers();
}); 