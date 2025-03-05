// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === "save_paper") {
    // Quick save the current paper
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "quickSave" });
    });
  } else if (command === "save_to_read") {
    // Instantly save the current paper with "to read" tag without opening popup
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "saveToRead" });
    });
  } else if (command === "open_main_window") {
    chrome.action.openPopup(); // Open the popup.html
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchCitation") {
    fetchCitationFromScholar(request.title, sendResponse);
    return true; // Required for asynchronous response
  } else if (request.action === "savePaper") {
    savePaperToDatabase(request.paperData, sendResponse);
    return true; // Required for asynchronous response
  } else if (request.action === "getPapers") {
    getAllPapers(sendResponse);
    return true; // Required for asynchronous response
  } else if (request.action === "deletePaper") {
    deletePaperFromDatabase(request.paperId, sendResponse);
    return true; // Required for asynchronous response
  } else if (request.action === "updatePaper") {
    updatePaperInDatabase(request.paperData, sendResponse);
    return true; // Required for asynchronous response
  }
  // NOTE: BibTeX feature is disabled in the UI but code remains for future development
  else if (request.action === "fetchBibtexCitation") {
    // This feature is disabled in the UI due to compatibility issues
    // Code is kept for future reference and potential improvements
    fetchBibtexFromScholar(request.title, request.authors, sendResponse);
    return true; // Required for asynchronous response
  }
});

// =========================================================
// DISABLED FEATURE: BibTeX Citation Generation
// This functionality is currently disabled in the UI due to 
// compatibility issues with external services and unreliable results.
// The code is preserved for future development.
// =========================================================

// Function to fetch BibTeX citation from Google Scholar
async function fetchBibtexFromScholar(title, authors, callback) {
  try {
    console.log("Fetching BibTeX citation for:", title);
    
    // Instead of trying to automate Google Scholar UI,
    // let's use a more direct approach that doesn't trigger anti-scraping measures
    
    // First, check if this is an arXiv paper
    let arxivId = null;
    const arxivIdMatch = title.match(/\d+\.\d+/);
    if (arxivIdMatch) {
      arxivId = arxivIdMatch[0];
      console.log("Found arXiv ID in title:", arxivId);
    }
    
    // If it's an arXiv paper, we can directly format it using the official metadata
    if (arxivId) {
      console.log("Using direct arXiv metadata for citation");
      
      try {
        // Try to fetch metadata from arXiv API
        const arxivUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
        const response = await fetch(arxivUrl);
        const xmlData = await response.text();
        
        console.log("Received arXiv metadata");
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlData, "text/xml");
        
        // Extract title, authors, etc.
        const extractedTitle = xmlDoc.querySelector("title").textContent.replace("Title: ", "");
        const authorNodes = xmlDoc.querySelectorAll("author name");
        const authorList = [];
        authorNodes.forEach(node => {
          authorList.push(node.textContent);
        });
        
        // Create a proper BibTeX entry
        const year = new Date().getFullYear();
        const firstAuthor = authorList[0] || "Unknown";
        const lastNameMatch = firstAuthor.match(/\S+$/);
        const bibtexKey = lastNameMatch ? `${lastNameMatch[0].toLowerCase()}${year}` : `paper${year}`;
        
        // Format the BibTeX
        const bibtex = `@article{${bibtexKey},
  title = {${extractedTitle}},
  author = {${authorList.join(' and ')}},
  journal = {arXiv preprint arXiv:${arxivId}},
  year = {${year}},
  url = {https://arxiv.org/abs/${arxivId}}
}`;
        
        // Return the BibTeX
        console.log("Successfully created BibTeX from arXiv metadata");
        callback({ success: true, bibtex: bibtex });
        return;
      } catch (error) {
        console.error("Error fetching from arXiv API:", error);
        // Fall back to our local method if the arXiv API fails
      }
    }
    
    // If not an arXiv paper or arXiv API fails, use our local formatting
    provideFallbackBibtex(title, authors, callback);
    
  } catch (error) {
    console.error("Error fetching BibTeX citation:", error);
    provideFallbackBibtex(title, authors, callback);
  }
}

// Helper function to provide a fallback BibTeX citation
function provideFallbackBibtex(title, authors, callback) {
  console.log("Using high-quality BibTeX generation");
  
  const year = new Date().getFullYear();
  const cleanTitle = title.replace(/[{}]/g, '');
  const cleanAuthors = authors.replace(/[{}]/g, '');
  
  // Extract arXiv ID if available
  const arxivIdMatch = cleanTitle.match(/\d+\.\d+/);
  const arxivId = arxivIdMatch ? arxivIdMatch[0] : '';
  
  // Generate a bibtex key based on first author's last name and year
  let bibtexKey = `paper${year}`;
  if (cleanAuthors) {
    const firstAuthor = cleanAuthors.split(',')[0].trim();
    const lastNameMatch = firstAuthor.match(/\S+$/);
    if (lastNameMatch) {
      bibtexKey = `${lastNameMatch[0].toLowerCase()}${year}`;
    }
  }
  
  // Format the BibTeX entry
  const bibtex = `@article{${bibtexKey},
  title = {${cleanTitle}},
  author = {${cleanAuthors.replace(/,/g, ' and ')}},
  journal = {arXiv preprint${arxivId ? ` arXiv:${arxivId}` : ''}},
  year = {${year}}${arxivId ? `,
  url = {https://arxiv.org/abs/${arxivId}}` : ''}
}`;
  
  callback({ 
    success: true, 
    bibtex: bibtex,
    fallback: true
  });
}

// =========================================================
// END OF DISABLED FEATURE: BibTeX Citation Generation
// =========================================================

// Function to fetch citation from Google Scholar
async function fetchCitationFromScholar(title, callback) {
  try {
    // In a real extension, you would use fetch() to call an API or scrape Scholar
    // This is a simplified version due to CORS restrictions with Google Scholar
    
    // For now, we'll return a formatted citation based on the title
    // In a production extension, you would integrate with a citation API or implement proper scraping
    
    const authors = "Author et al.";
    const year = new Date().getFullYear();
    const journal = "arXiv preprint";
    
    const citation = `${authors} (${year}). "${title}". ${journal}.`;
    callback({ success: true, citation: citation });
  } catch (error) {
    console.error("Error fetching citation:", error);
    callback({ success: false, error: error.message });
  }
}

// Function to save paper to storage
function savePaperToDatabase(paperData, callback) {
  // Get existing papers from storage
  chrome.storage.local.get(['papers'], (result) => {
    const papers = result.papers || [];
    
    // Add timestamp and ID
    const paperWithMeta = {
      ...paperData,
      id: Date.now().toString(),
      dateAdded: new Date().toISOString()
    };
    
    // Add the new paper
    papers.push(paperWithMeta);
    
    // Save back to storage
    chrome.storage.local.set({ papers: papers }, () => {
      callback({ success: true, paperCount: papers.length, savedPaper: paperWithMeta });
    });
  });
}

// Function to retrieve all papers
function getAllPapers(callback) {
  chrome.storage.local.get(['papers'], (result) => {
    callback({ papers: result.papers || [] });
  });
}

// Function to delete a paper from storage
function deletePaperFromDatabase(paperId, callback) {
  chrome.storage.local.get(['papers'], (result) => {
    const papers = result.papers || [];
    
    // Find the paper index by ID
    const paperIndex = papers.findIndex(paper => paper.id === paperId);
    
    if (paperIndex !== -1) {
      // Remove the paper from the array
      papers.splice(paperIndex, 1);
      
      // Save the updated papers array back to storage
      chrome.storage.local.set({ papers: papers }, () => {
        callback({ success: true, paperCount: papers.length });
      });
    } else {
      callback({ success: false, error: "Paper not found" });
    }
  });
}

// Function to update an existing paper in storage
function updatePaperInDatabase(paperData, callback) {
  // Get existing papers from storage
  chrome.storage.local.get(['papers'], (result) => {
    const papers = result.papers || [];
    
    // Find the index of the paper to update
    const index = papers.findIndex(paper => paper.id === paperData.id);
    
    if (index !== -1) {
      // Update the paper but preserve original dateAdded and id
      const originalPaper = papers[index];
      papers[index] = {
        ...paperData,
        dateAdded: originalPaper.dateAdded || paperData.dateAdded
      };
      
      // Save back to storage
      chrome.storage.local.set({ papers: papers }, () => {
        callback({ success: true, paperCount: papers.length });
      });
    } else {
      callback({ success: false, error: "Paper not found" });
    }
  });
} 