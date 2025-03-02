// This is a content script for fetching BibTeX from Google Scholar
// It can be implemented in the future when full Google Scholar integration is needed

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractBibtex") {
    console.log("Extracting BibTeX from Google Scholar page");
    const bibtex = extractBibtexFromPage();
    sendResponse({ success: true, bibtex: bibtex });
  }
  return true;
});

// Extract BibTeX from Google Scholar page
function extractBibtexFromPage() {
  // On the BibTeX page, the text is in a <pre> tag
  const preElement = document.querySelector('pre');
  if (preElement) {
    return preElement.textContent;
  }
  
  // If we're on the search results page, look for citation links
  const citeButtons = Array.from(document.querySelectorAll('a.gs_or_cit'));
  if (citeButtons.length > 0) {
    console.log("Found citation buttons:", citeButtons.length);
    // We found citation buttons but we're not on the BibTeX page yet
    // In a real implementation, you would need to:
    // 1. Click the citation button
    // 2. Click BibTeX in the dropdown
    // 3. Extract from the new page that opens
    return "Found citation buttons, but not on BibTeX page yet";
  }
  
  return "No BibTeX found on this page";
}

// A more comprehensive implementation would include:
/*
async function getBibtexForPaper(title, authors) {
  // 1. Search Google Scholar for the paper
  const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
  
  // 2. Open a tab for the search
  const tab = await chrome.tabs.create({ url: searchUrl, active: false });
  
  // 3. Wait for the page to load and execute a content script
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 4. Execute content script to find the paper and click citation
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: findAndClickCitation,
    args: [title]
  });
  
  // 5. Wait for the citation dialog
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 6. Click the BibTeX option
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: clickBibtexOption
  });
  
  // 7. Wait for the BibTeX page to load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 8. Extract the BibTeX
  const bibtexResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractBibtex
  });
  
  // 9. Close the tab
  chrome.tabs.remove(tab.id);
  
  // 10. Return the BibTeX
  return bibtexResults[0].result;
}

// Helper functions to be injected into the page
function findAndClickCitation(title) {
  // Find the paper result that best matches the title
  const resultTitles = document.querySelectorAll('.gs_rt');
  let bestMatch = null;
  let bestMatchScore = 0;
  
  for (const titleElem of resultTitles) {
    const resultTitle = titleElem.textContent;
    const similarity = calculateSimilarity(resultTitle, title);
    if (similarity > bestMatchScore && similarity > 0.7) {
      bestMatchScore = similarity;
      bestMatch = titleElem.closest('.gs_r');
    }
  }
  
  if (bestMatch) {
    // Find and click the citation button
    const citeButton = bestMatch.querySelector('.gs_or_cit');
    if (citeButton) {
      citeButton.click();
      return true;
    }
  }
  
  return false;
}

function clickBibtexOption() {
  // Find and click the BibTeX option in the citation popup
  const bibtexLinks = Array.from(document.querySelectorAll('a')).filter(a => 
    a.textContent.includes('BibTeX')
  );
  
  if (bibtexLinks.length > 0) {
    bibtexLinks[0].click();
    return true;
  }
  
  return false;
}

function extractBibtex() {
  // Extract BibTeX from the pre element
  const preElement = document.querySelector('pre');
  if (preElement) {
    return preElement.textContent;
  }
  return null;
}

// Simple string similarity function
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const total = Math.max(s1.length, s2.length);
  let matches = 0;
  
  // Count matching words
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  for (const word of words1) {
    if (word.length > 3 && words2.includes(word)) {
      matches++;
    }
  }
  
  return matches / Math.min(words1.length, words2.length);
}
*/ 