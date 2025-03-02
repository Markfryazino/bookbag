/**
 * DISABLED FEATURES - BibTeX Citation Generation
 * 
 * This file contains code for features that were disabled due to compatibility issues.
 * The code is preserved here for future development and reference.
 * 
 * Feature: BibTeX Citation Generation
 * Status: DISABLED
 * Reason: Unreliable results and incompatibility with Google Scholar anti-scraping measures
 * 
 * The feature was intended to:
 * 1. Fetch BibTeX citations from Google Scholar
 * 2. Display them in a popup for users to copy
 * 3. Provide a fallback citation generator if Scholar failed
 */

// ========== UI COMPONENTS ==========

// Function to add BibTeX button to paper items
function addBibtexButtonToPaperItem(paperItem, paperActions, paper) {
  // Create BibTeX button
  const bibtexButton = document.createElement('button');
  bibtexButton.className = 'bibtex-btn secondary';
  bibtexButton.textContent = 'BibTeX';
  bibtexButton.title = 'Get BibTeX citation';
  bibtexButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent opening the paper
    fetchBibtexCitation(paper);
  });
  
  paperActions.appendChild(bibtexButton);
  paperItem.appendChild(paperActions);
}

// Fetch and display BibTeX citation
function fetchBibtexCitation(paper) {
  showNotification('Fetching BibTeX citation...');
  
  // Show loading popup immediately
  const loadingBibtex = `// Fetching BibTeX citation...
// Please wait a moment.`;
  showBibtexPopup(paper.title, loadingBibtex, true);
  
  chrome.runtime.sendMessage({ 
    action: "fetchBibtexCitation", 
    title: paper.title,
    authors: paper.authors
  }, response => {
    if (response.success) {
      // Update the existing popup with the actual BibTeX
      updateBibtexPopup(paper.title, response.bibtex, response.fallback);
    } else {
      showNotification('Error fetching BibTeX citation: ' + response.error);
      // Update popup with error message
      updateBibtexPopup(paper.title, 
        `// Error fetching BibTeX citation.
// Please try again later.`, 
        true);
    }
  });
}

// Show BibTeX popup
function showBibtexPopup(title, bibtex, isLoading = false) {
  // Remove any existing popup
  const existingPopup = document.getElementById("bibtex-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  // Create popup container
  const popup = document.createElement("div");
  popup.id = "bibtex-popup";
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    max-width: 90%;
    background: white;
    box-shadow: 0 4px 23px 0 rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 20px;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;

  // Create popup content
  popup.innerHTML = `
    <h2 style="margin-top: 0; color: #333;">BibTeX Citation</h2>
    <div style="margin-bottom: 15px;">
      <strong>${title}</strong>
    </div>
    <div style="margin-bottom: 15px;">
      <textarea id="bibtex-content" style="width: 100%; height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; font-family: monospace; font-size: 12px;">${bibtex}</textarea>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div id="bibtex-status" style="font-size: 12px; color: ${isLoading ? '#ff9800' : '#4CAF50'};">
        ${isLoading ? 'Generating citation...' : 'BibTeX citation ready'}
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="copy-bibtex" style="padding: 8px 16px; border: none; background: #4285f4; color: white; border-radius: 4px; cursor: pointer;" ${isLoading ? 'disabled' : ''}>Copy to Clipboard</button>
        <button id="close-bibtex" style="padding: 8px 16px; border: none; background: #f1f1f1; border-radius: 4px; cursor: pointer;">Close</button>
      </div>
    </div>
  `;

  // Add popup to page
  document.body.appendChild(popup);

  // Add backdrop
  const backdrop = document.createElement("div");
  backdrop.id = "bibtex-backdrop";
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  `;
  document.body.appendChild(backdrop);

  // Add event listeners
  document.getElementById("close-bibtex").addEventListener("click", () => {
    popup.remove();
    backdrop.remove();
  });

  if (!isLoading) {
    document.getElementById("copy-bibtex").addEventListener("click", () => {
      const bibtexContent = document.getElementById("bibtex-content");
      bibtexContent.select();
      document.execCommand('copy');
      showNotification("BibTeX copied to clipboard!");
    });
  }

  // Close popup when clicking outside
  backdrop.addEventListener("click", () => {
    popup.remove();
    backdrop.remove();
  });

  // Prevent closing when clicking on the popup itself
  popup.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

// Update an existing BibTeX popup with new content
function updateBibtexPopup(title, bibtex, isFallback = false) {
  const popup = document.getElementById("bibtex-popup");
  if (!popup) return;
  
  const bibtexContent = document.getElementById("bibtex-content");
  if (bibtexContent) {
    bibtexContent.value = bibtex;
  }
  
  const bibtexStatus = document.getElementById("bibtex-status");
  if (bibtexStatus) {
    bibtexStatus.textContent = isFallback 
      ? 'Generated from paper metadata'
      : 'BibTeX citation from arXiv metadata';
    bibtexStatus.style.color = '#4CAF50';
  }
  
  const copyButton = document.getElementById("copy-bibtex");
  if (copyButton) {
    copyButton.disabled = false;
    copyButton.addEventListener("click", () => {
      const bibtexContent = document.getElementById("bibtex-content");
      bibtexContent.select();
      document.execCommand('copy');
      showNotification("BibTeX copied to clipboard!");
    });
  }
}

// ========== IMPLEMENTATION NOTES ==========

/**
 * REASONS FOR FEATURE FAILURE:
 * 
 * 1. Google Scholar Anti-Scraping Measures
 *    - Google Scholar actively blocks automated access
 *    - Their UI changes frequently to prevent scraping
 *    - CAPTCHAs appear when too many requests are made
 * 
 * 2. Browser Extension Limitations
 *    - Content script execution is limited in browser extensions
 *    - Chrome's security model prevents some types of automation
 *    - DOMParser in background.js has limited XML parsing capabilities
 * 
 * 3. Alternative Approaches Considered
 *    - Direct citation generation using arXiv metadata (partially worked)
 *    - Using an external API service (would require backend)
 *    - Manual citation generation based on saved metadata (fallback implemented)
 * 
 * FUTURE DEVELOPMENT IDEAS:
 * 
 * 1. Server API
 *    - Create a small backend service that handles Scholar requests
 *    - This would avoid browser extension limitations
 * 
 * 2. Alternative Citation Sources
 *    - Crossref API (https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
 *    - Semantic Scholar API (https://www.semanticscholar.org/product/api)
 *    - Unpaywall API (https://unpaywall.org/products/api)
 * 
 * 3. Local Citation Database
 *    - Bundle a database of common citations
 *    - Focus on arXiv papers for a specialized use case
 */ 