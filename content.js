// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request.action);
  
  if (request.action === "quickSave" || request.action === "getPaperInfo" || request.action === "saveToRead") {
    const isPDF = window.location.pathname.includes('/pdf/') || window.location.pathname.endsWith('.pdf');
    console.log("Is PDF page:", isPDF, "Path:", window.location.pathname);
    
    let paperInfo;
    if (isPDF) {
      paperInfo = extractPaperInfoFromPDFUrl();
      if (request.action === "getPaperInfo") {
        // For getPaperInfo, we want to fetch metadata immediately
        fetchMetadataFromAbstractPage(paperInfo.url)
          .then(metadata => {
            console.log("Fetched metadata:", metadata);
            sendResponse({ ...paperInfo, ...metadata, isLoading: false });
          })
          .catch(error => {
            console.error("Error fetching metadata:", error);
            sendResponse(paperInfo);
          });
        return true; // Keep the message channel open for the async response
      } else if (request.action === "saveToRead") {
        // For saveToRead on PDF page, fetch metadata and then save with "to read" tag
        fetchMetadataFromAbstractPage(paperInfo.url)
          .then(metadata => {
            console.log("Fetched metadata for instant save:", metadata);
            saveToReadList({ ...paperInfo, ...metadata, isLoading: false });
          })
          .catch(error => {
            console.error("Error fetching metadata for instant save:", error);
            saveToReadList(paperInfo); // Try to save even with limited info
          });
        return true;
      }
    } else {
      paperInfo = extractPaperInfo();
      if (request.action === "getPaperInfo") {
        sendResponse(paperInfo);
      } else if (request.action === "saveToRead") {
        // For saveToRead on abstract page, save immediately with "to read" tag
        saveToReadList(paperInfo);
        return true;
      }
    }
    
    if (request.action === "quickSave") {
      // Check if the paper is already saved before showing the quick save popup
      checkIfPaperIsSaved(paperInfo).then(savedPaper => {
        if (savedPaper) {
          console.log("Paper already saved, showing with saved data:", savedPaper);
          showQuickSavePopup(savedPaper, true);
        } else {
          showQuickSavePopup(paperInfo);
        }
      });
    }
  } else if (request.action === "openSavedPaper") {
    console.log("Opening saved paper with notes:", request.paperData);
    // Check if we're on the right page before showing popup
    const currentUrl = window.location.href;
    const paperUrl = request.paperData.pdfUrl || request.paperData.url;
    
    // Only show if we're on a matching page (allowing for http/https and www differences)
    if (currentUrl.includes(request.paperData.arxivId)) {
      // Wait a moment for the page to fully initialize
      setTimeout(() => {
        showSavedPaperPopup(request.paperData);
      }, 1000);
    } else {
      console.log("URL mismatch, not showing popup", { current: currentUrl, paper: paperUrl });
    }
  }
  return true;
});

// When page loads, check if current paper is already saved
document.addEventListener('DOMContentLoaded', function() {
  // Only run on arXiv pages
  if (!window.location.hostname.includes('arxiv.org')) {
    return;
  }
  
  console.log("Page loaded, checking if current paper is already saved");
  
  // Extract paper info based on page type
  const isPDF = window.location.pathname.includes('/pdf/') || window.location.pathname.endsWith('.pdf');
  let paperInfo;
  
  if (isPDF) {
    paperInfo = extractPaperInfoFromPDFUrl();
    // For PDF pages, we need to fetch metadata to get complete info
    fetchMetadataFromAbstractPage(paperInfo.url)
      .then(metadata => {
        const enrichedPaperInfo = { ...paperInfo, ...metadata, isLoading: false };
        checkAndShowExistingPaper(enrichedPaperInfo);
      })
      .catch(error => {
        console.error("Error fetching metadata:", error);
        checkAndShowExistingPaper(paperInfo);
      });
  } else {
    paperInfo = extractPaperInfo();
    checkAndShowExistingPaper(paperInfo);
  }
});

// Function to check if the paper is saved and show the popup if it is
function checkAndShowExistingPaper(paperInfo) {
  if (!paperInfo || !paperInfo.arxivId) {
    return;
  }
  
  checkIfPaperIsSaved(paperInfo).then(savedPaper => {
    if (savedPaper) {
      console.log("Current paper is already saved, displaying popup after page load");
      // Use a small delay to ensure the page is fully rendered
      setTimeout(() => {
        showSavedPaperPopup(savedPaper);
      }, 1500);
    }
  });
}

// Extract paper information from PDF URL
function extractPaperInfoFromPDFUrl() {
  console.log("Extracting paper info from PDF URL...");
  const url = window.location.href;
  
  // Convert PDF URL to abstract URL
  let abstractUrl = url;
  if (url.includes('/pdf/')) {
    abstractUrl = url.replace('/pdf/', '/abs/').replace('.pdf', '');
  } else if (url.endsWith('.pdf')) {
    abstractUrl = url.replace('.pdf', '').replace('/abs/', '/pdf/');
  }
  
  console.log("Abstract URL:", abstractUrl);
  
  // Extract arXiv ID from the URL using a more robust pattern
  const arxivIdMatch = url.match(/(?:abs|pdf|arxiv)\/(\d+\.\d+)/i) || url.match(/(\d{4}\.\d{4,5})/);
  const arxivId = arxivIdMatch ? arxivIdMatch[1] : "";
  console.log("ArXiv ID:", arxivId);
  
  // For PDF pages, we'll fetch the metadata from the abstract page
  return {
    title: `arXiv:${arxivId}`, // Temporary title using ID
    authors: "Loading authors...",
    abstract: "Loading abstract...",
    url: abstractUrl,
    arxivId: arxivId,
    pdfUrl: url,
    isLoading: true
  };
}

// Extract paper information from the arXiv abstract page
function extractPaperInfo() {
  console.log("Starting paper info extraction...");
  
  let title = "";
  let authors = "";
  let abstract = "";
  let url = window.location.href;

  try {
    // Extract title - try multiple possible selectors
    const titleSelectors = [
      "h1.title",
      ".title",
      "#abs > h1",
      "h1:first-of-type",
      "[class*='title']"  // Any element with 'title' in its class
    ];
    
    let titleElement = null;
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found title using selector: ${selector}`, {
          element: element,
          text: element.textContent
        });
        titleElement = element;
        break;
      }
    }
    
    if (titleElement) {
      title = titleElement.textContent.replace(/^Title:?\s*/i, "").trim();
      console.log("Processed title:", title);
    } else {
      console.log("No title element found with any selector:", titleSelectors);
    }

    // Extract authors - try multiple possible selectors
    const authorSelectors = [
      ".authors",
      ".meta",
      "#abs > div.authors",
      "[class*='author']",  // Any element with 'author' in its class
      "div.authors",
      "div.meta > div.authors"
    ];
    
    let authorElement = null;
    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found authors using selector: ${selector}`, {
          element: element,
          text: element.textContent
        });
        authorElement = element;
        break;
      }
    }
    
    if (authorElement) {
      authors = authorElement.textContent.replace(/^Authors?:?\s*/i, "").trim();
      console.log("Processed authors:", authors);
    } else {
      console.log("No author element found with any selector:", authorSelectors);
    }

    // Extract abstract - try multiple possible selectors
    const abstractSelectors = [
      ".abstract",
      "#abs > blockquote",
      "blockquote.abstract",
      "[class*='abstract']",  // Any element with 'abstract' in its class
      "blockquote"
    ];
    
    let abstractElement = null;
    for (const selector of abstractSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found abstract using selector: ${selector}`, {
          element: element,
          text: element.textContent
        });
        abstractElement = element;
        break;
      }
    }
    
    if (abstractElement) {
      abstract = abstractElement.textContent.replace(/^Abstract:?\s*/i, "").trim();
      console.log("Processed abstract:", abstract);
    } else {
      console.log("No abstract element found with any selector:", abstractSelectors);
    }

    // Get arXiv ID from URL
    const arxivId = url.match(/\d+\.\d+/) ? url.match(/\d+\.\d+/)[0] : "";
    console.log("ArXiv ID:", arxivId);

    const paperInfo = {
      title,
      authors,
      abstract,
      url,
      arxivId,
      pdfUrl: url.replace("abs", "pdf") + ".pdf"
    };

    console.log("Final paper info:", paperInfo);
    return paperInfo;

  } catch (error) {
    console.error("Error extracting paper info:", error);
    return {
      title: "",
      authors: "",
      abstract: "",
      url,
      arxivId: "",
      pdfUrl: ""
    };
  }
}

// Function to check if a paper is already saved in the library
async function checkIfPaperIsSaved(paperInfo) {
  return new Promise(resolve => {
    if (!paperInfo || !paperInfo.arxivId) {
      console.log("No valid paper info or arXiv ID to check");
      return resolve(null);
    }
    
    console.log("Checking if paper is already saved:", paperInfo.arxivId);
    
    chrome.runtime.sendMessage({ action: "getPapers" }, response => {
      if (response && response.papers && response.papers.length > 0) {
        // Look for a paper with matching arXiv ID
        const savedPaper = response.papers.find(paper => 
          paper.arxivId === paperInfo.arxivId);
        
        if (savedPaper) {
          console.log("Found saved paper:", savedPaper);
          resolve(savedPaper);
        } else {
          console.log("Paper not found in saved papers");
          resolve(null);
        }
      } else {
        console.log("No saved papers or error retrieving them");
        resolve(null);
      }
    });
  });
}

// Function to show quick save popup
function showQuickSavePopup(paperInfo, isExistingPaper = false) {
  console.log("Showing quick save popup with data:", paperInfo, "isExistingPaper:", isExistingPaper);
  
  // If this is a PDF page and metadata is still loading, fetch it first
  if (paperInfo.isLoading) {
    fetchMetadataFromAbstractPage(paperInfo.url).then(metadata => {
      showPopupWithData({ ...paperInfo, ...metadata, isLoading: false }, isExistingPaper);
    }).catch(error => {
      console.error("Error fetching metadata:", error);
      showPopupWithData(paperInfo, isExistingPaper); // Show popup with basic info if fetch fails
    });
  } else {
    showPopupWithData(paperInfo, isExistingPaper);
  }
}

// Fetch metadata from the abstract page
async function fetchMetadataFromAbstractPage(abstractUrl) {
  console.log("Fetching metadata from:", abstractUrl);
  
  try {
    const response = await fetch(abstractUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract information from the abstract page
    const title = extractTextFromSelectors(doc, [
      "h1.title",
      ".title",
      "#abs > h1",
      "h1:first-of-type",
      "[class*='title']"
    ]).replace(/^Title:?\s*/i, "").trim();
    
    const authors = extractTextFromSelectors(doc, [
      ".authors",
      ".meta",
      "#abs > div.authors",
      "[class*='author']",
      "div.authors",
      "div.meta > div.authors"
    ]).replace(/^Authors?:?\s*/i, "").trim();
    
    const abstract = extractTextFromSelectors(doc, [
      ".abstract",
      "#abs > blockquote",
      "blockquote.abstract",
      "[class*='abstract']",
      "blockquote"
    ]).replace(/^Abstract:?\s*/i, "").trim();
    
    console.log("Extracted metadata:", { title, authors, abstract });
    
    if (!title && !authors && !abstract) {
      throw new Error("No metadata found in the abstract page");
    }
    
    return { title, authors, abstract };
  } catch (error) {
    console.error("Error fetching abstract page:", error);
    throw error;
  }
}

// Helper function to extract text using multiple selectors
function extractTextFromSelectors(doc, selectors) {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element) {
      return element.textContent;
    }
  }
  return "";
}

// Function to show popup with saved paper data
function showSavedPaperPopup(paperData) {
  // Use the existing showPopupWithData function but pre-fill with saved data
  showPopupWithData(paperData, true);
}

// Show popup with the provided data
function showPopupWithData(paperInfo, isExistingPaper = false) {
  console.log("Showing popup with data:", paperInfo, "isExistingPaper:", isExistingPaper);

  try {
    // Remove any existing popup
    const existingPopup = document.getElementById("paper-saver-popup");
    if (existingPopup) {
      existingPopup.remove();
      return; // Toggle behavior - if popup exists, just remove it and return
    }

    // Create popup container
    const popup = document.createElement("div");
    popup.id = "paper-saver-popup";
    popup.style.cssText = `
      position: fixed;
      top: 80px;
      right: 30px;
      width: 350px;
      max-width: 30%;
      background: white;
      box-shadow: 0 4px 23px 0 rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      z-index: 99999;
      font-family: Arial, sans-serif;
      resize: both;
      overflow: auto;
      min-width: 300px;
      min-height: 200px;
      max-height: 80vh;
    `;

    // Ensure it's draggable
    makeDraggable(popup);

    // Create popup header
    const header = document.createElement("div");
    header.style.cssText = `
      background: #4285f4;
      color: white;
      padding: 12px 15px;
      font-weight: bold;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
    `;
    header.innerHTML = isExistingPaper ? 'Paper Notes' : 'Save Paper';
    header.className = 'popup-header';
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      margin: 0;
      line-height: 1;
    `;
    closeButton.addEventListener('click', () => {
      popup.remove();
    });
    header.appendChild(closeButton);

    popup.appendChild(header);

    // Create popup content
    const content = document.createElement("div");
    content.style.cssText = "padding: 15px;";

    // Title
    content.innerHTML += `<div style="margin-bottom: 15px;">
      <div style="font-weight: bold; margin-bottom: 5px;">Title</div>
      <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${paperInfo.title || ''}</div>
    </div>`;

    // Authors
    content.innerHTML += `<div style="margin-bottom: 15px;">
      <div style="font-weight: bold; margin-bottom: 5px;">Authors</div>
      <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${paperInfo.authors || ''}</div>
    </div>`;

    // Notes
    content.innerHTML += `<div style="margin-bottom: 15px;">
      <div style="font-weight: bold; margin-bottom: 5px;">Notes</div>
      <textarea id="paper-notes-input" style="width: 100%; height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;">${paperInfo.notes || ''}</textarea>
    </div>`;

    // Tags
    content.innerHTML += `<div style="margin-bottom: 15px;">
      <div style="font-weight: bold; margin-bottom: 5px;">Tags (comma separated)</div>
      <input type="text" id="paper-tags-input" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" value="${paperInfo.tags ? paperInfo.tags.join(', ') : ''}">
    </div>`;

    // Status indicator for auto-save
    content.innerHTML += `<div id="auto-save-status" style="font-size: 12px; color: #888; text-align: right; margin-top: 10px;">
      ${isExistingPaper ? 'Auto-saving enabled' : 'Type in notes to save paper'}
    </div>`;

    popup.appendChild(content);
    document.body.appendChild(popup);

    // Set up auto-save for all papers (new and existing)
    let autoSaveTimeout;
    const notesInput = document.getElementById("paper-notes-input");
    const tagsInput = document.getElementById("paper-tags-input");
    const statusElement = document.getElementById("auto-save-status");
    
    // Focus on the notes textarea when popup is created
    setTimeout(() => {
      notesInput.focus();
    }, 100);
    
    // Function to update status
    const updateStatus = (message, isError = false) => {
      statusElement.textContent = message;
      statusElement.style.color = isError ? '#d32f2f' : '#4caf50';
      setTimeout(() => {
        statusElement.textContent = isExistingPaper ? 'Auto-saving enabled' : 'Type in notes to save paper';
        statusElement.style.color = '#888';
      }, 3000);
    };
    
    // Function to handle auto-save
    const handleAutoSave = () => {
      clearTimeout(autoSaveTimeout);
      statusElement.textContent = 'Saving...';
      
      // Set a timeout to avoid saving on every keystroke
      autoSaveTimeout = setTimeout(() => {
        const notes = notesInput.value;
        const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        if (isExistingPaper) {
          // Update existing paper
          const updatedPaper = {
            ...paperInfo,
            notes: notes,
            tags: tags
          };
          
          chrome.runtime.sendMessage({
            action: "updatePaper",
            paperData: updatedPaper
          }, response => {
            if (response && response.success) {
              updateStatus("Saved");
              // Update our local reference to paperInfo
              paperInfo.notes = notes;
              paperInfo.tags = tags;
            } else {
              updateStatus("Error saving", true);
            }
          });
        } else {
          // Save new paper if notes have been entered
          if (notes.trim() !== '') {
            chrome.runtime.sendMessage({
              action: "fetchCitation",
              title: paperInfo.title
            }, response => {
              if (response && response.success) {
                const paperData = {
                  ...paperInfo,
                  notes: notes,
                  tags: tags,
                  citation: response.citation
                };

                chrome.runtime.sendMessage({
                  action: "savePaper",
                  paperData: paperData
                }, saveResponse => {
                  if (saveResponse && saveResponse.success) {
                    updateStatus("Paper saved");
                    // Update isExistingPaper so future edits are treated as updates
                    isExistingPaper = true;
                    // Update header to reflect that the paper is now saved
                    header.innerHTML = 'Paper Notes';
                    closeButton.outerHTML = closeButton.outerHTML; // Re-create the button to reset event listeners
                    popup.querySelector('.popup-header button').addEventListener('click', () => popup.remove());
                    // Update our local reference to paperInfo to include the new ID
                    paperInfo = { ...paperData, id: Date.now().toString() };
                  } else {
                    updateStatus("Error saving paper", true);
                  }
                });
              } else {
                updateStatus("Error fetching citation", true);
              }
            });
          }
        }
      }, 1000); // Wait 1 second after typing stops
    };
    
    // Add event listeners for input changes
    notesInput.addEventListener("input", handleAutoSave);
    tagsInput.addEventListener("input", handleAutoSave);

    // Add keyboard shortcut (ESC to close)
    document.addEventListener("keydown", function escKeyHandler(e) {
      if (e.key === "Escape") {
        popup.remove();
        document.removeEventListener("keydown", escKeyHandler);
      }
    });

    // Add keyboard shortcut (Enter to focus notes)
    document.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && document.activeElement !== notesInput) {
        e.preventDefault();
        notesInput.focus();
      }
    });

    // Add global keyboard shortcut listener for Ctrl+Shift+P to toggle popup
    document.addEventListener("keydown", function(e) {
      // Check for Ctrl+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault(); // Prevent default browser behavior
        popup.remove();
      }
    });

    console.log("Popup created and added to the page");
  } catch (error) {
    console.error("Error showing popup:", error);
    alert("Error showing the notes popup. Please check the console for details.");
  }
}

// Function to make an element draggable
function makeDraggable(element) {
  const header = element.querySelector('.popup-header');
  if (!header) return;
  
  // Add visual indicator that the header is draggable
  header.style.cursor = 'move';
  
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  // Get initial position
  const setInitialPosition = () => {
    const rect = element.getBoundingClientRect();
    
    // Convert from centered positioning to absolute positioning
    if (element.style.transform.includes('translate')) {
      element.style.top = rect.top + 'px';
      element.style.left = rect.left + 'px';
      element.style.transform = 'none';
    }
  };
  
  const mouseDownHandler = function(e) {
    // Only handle primary mouse button (left click)
    if (e.button !== 0) return;
    
    e.preventDefault();
    
    // Set initial position on first drag
    setInitialPosition();
    
    // Record the initial mouse position
    startX = e.clientX;
    startY = e.clientY;
    
    // Record the initial element position
    const rect = element.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    // Flag that we're starting to drag
    isDragging = true;
    
    // Add visual indication of dragging
    header.classList.add('dragging');
    element.classList.add('dragging');
    
    // Add the move and up handlers to the document
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    
    console.log('Drag started', { startX, startY, startLeft, startTop });
  };
  
  const mouseMoveHandler = function(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Calculate the new position
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // Apply the new position
    element.style.left = startLeft + dx + 'px';
    element.style.top = startTop + dy + 'px';
    
    console.log('Moving', { left: element.style.left, top: element.style.top });
  };
  
  const mouseUpHandler = function() {
    isDragging = false;
    
    // Remove the visual indication of dragging
    header.classList.remove('dragging');
    element.classList.remove('dragging');
    
    // Remove the handlers when done
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    
    console.log('Drag ended');
  };
  
  // Attach the mousedown handler to the header
  header.addEventListener('mousedown', mouseDownHandler);
  
  // Add a special class for styling
  header.classList.add('draggable-header');
  
  console.log('Draggable initialized with header', header);
}

// Show a notification
function showNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10001;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Add styles to the page
const style = document.createElement("style");
style.textContent = `
  #paper-saver-popup textarea:focus,
  #paper-saver-popup input:focus,
  #paper-saver-popup button:focus {
    outline: 2px solid #4285f4;
  }
  
  #paper-saver-popup button:hover {
    opacity: 0.9;
  }
  
  /* Resizable popup styles */
  #paper-saver-popup {
    resize: both;
    overflow: auto;
    transition: box-shadow 0.2s;
  }
  
  #paper-saver-popup::-webkit-resizer {
    border-style: solid;
    border-width: 10px;
    border-color: transparent #4285f4 #4285f4 transparent;
  }
  
  /* Draggable header styles */
  .popup-header {
    user-select: none;
    transition: background 0.2s;
  }
  
  .popup-header:hover {
    background: #3b78e7 !important;
  }
  
  .popup-close:hover {
    color: #f1f1f1;
  }
  
  /* Drag indicator animation */
  .popup-header.dragging {
    cursor: grabbing !important;
  }
  
  #paper-saver-popup.dragging {
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3) !important;
  }
  
  .drag-handle {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-right: 8px;
  }
  
  .drag-handle div {
    width: 20px;
    height: 2px;
    background-color: rgba(255,255,255,0.7);
    transition: background-color 0.2s;
  }
  
  .popup-header:hover .drag-handle div {
    background-color: rgba(255,255,255,0.9);
  }
`;
document.head.appendChild(style);

// Function to instantly save a paper to read list
function saveToReadList(paperInfo) {
  console.log("Instantly saving paper with 'to read' tag:", paperInfo);
  
  // Check if paper is already saved
  checkIfPaperIsSaved(paperInfo).then(savedPaper => {
    if (savedPaper) {
      console.log("Paper already saved, updating with 'to read' tag");
      
      // Make sure 'to read' tag is included in existing tags
      let tags = savedPaper.tags || [];
      if (!tags.includes('to read')) {
        tags.push('to read');
      }
      
      // Update the paper
      const updatedPaper = {
        ...savedPaper,
        tags: tags
      };
      
      chrome.runtime.sendMessage({
        action: "updatePaper",
        paperData: updatedPaper
      }, response => {
        if (response && response.success) {
          showNotification("Paper updated with 'to read' tag");
        } else {
          showNotification("Error updating paper", true);
        }
      });
    } else {
      // New paper - save with 'to read' tag
      chrome.runtime.sendMessage({
        action: "fetchCitation",
        title: paperInfo.title
      }, response => {
        if (response && response.success) {
          const paperData = {
            ...paperInfo,
            notes: "",
            tags: ["to read"],
            citation: response.citation
          };

          chrome.runtime.sendMessage({
            action: "savePaper",
            paperData: paperData
          }, saveResponse => {
            if (saveResponse && saveResponse.success) {
              showNotification("Paper saved to your 'to read' list");
            } else {
              showNotification("Error saving paper");
            }
          });
        } else {
          showNotification("Error fetching citation");
        }
      });
    }
  });
} 