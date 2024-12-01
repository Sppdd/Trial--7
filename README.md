# AI Task Manager Chrome Extension

A powerful Ai task manager powered by Google's Gemini Nano (Chrome's built-in AI) and Gemini Flash Models.

## Features

- 🤖 Dual AI Models:
  - Gemini Nano (Chrome's built-in AI) for quick, local analysis
  - Gemini Flash for more detailed insights
- Real-time Process Monitoring
- AI-Powered Performance Insights
- Natural language queries about system status
- Automated performance reports
- Contextual recommendations for optimization
---

## Installation

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Load the unpacked extension in Chrome
5. Enable the origin trial in Chrome flags and select bypassPerfR Enables optimization guide on device.
6. Download the model in chrome components. 

Visit Gemini built-in Prompt API documentation for more details here: https://developer.chrome.com/docs/extensions/ai/prompt-api .

### Prerequisites

- Node.js (v14 or higher)
- Chrome Browser (with AI Origin Trial enabled)
- API keys (for Gemini Flash model)

### Setup Environment

1. Create a `.env` file and add your API keys:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `GEMINI_FLASH`: 'gemini-1.5-flash'
2. Update the trial token in `manifest.json` (line 10) after enabling the origin trial in Chrome flags and getting the token from Chrome origin trial matched with the extension's ID. 


## Permissions

This extension requires the following permissions:
- `processes`: Monitor Chrome processes
- `system.cpu`: Access CPU usage data
- `system.memory`: Access memory usage data
- `aiLanguageModelOriginTrial`: Use Chrome's built-in AI
- `storage`: Store process logs
- `tabs`: Access tab information
- `webRequest`: Monitor network requests
- `history`: Access browsing history for context

