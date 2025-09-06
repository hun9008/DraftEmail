# DraftMail 📧

A Chrome extension that generates email drafts using local Ollama AI models and automatically inserts them into Gmail.

## Overview

DraftMail is a powerful Chrome extension that leverages local AI models through Ollama to help you compose professional emails. It integrates seamlessly with Gmail, allowing you to generate contextually appropriate email drafts based on your requirements and automatically insert them into the Gmail compose window.

## Features

### 🤖 AI-Powered Email Generation
- **Local AI Models**: Uses Ollama to run AI models locally on your machine
- **Multiple Model Support**: Compatible with various models like Llama, Qwen, Gemma, and more
- **Real-time Model Detection**: Automatically detects and lists available Ollama models

### 📝 Smart Email Composition
- **Recipient Categories**: Pre-defined categories for professors, school staff, recruiters, and custom options
- **Writing Styles**: Multiple style options including formal, friendly, concise, persuasive, apologetic, and assertive
- **Language Support**: Korean and English language options
- **Context-Aware**: Uses your notes and requirements to generate relevant content

### 🔗 Gmail Integration
- **Automatic Insertion**: Seamlessly inserts generated emails into Gmail compose window
- **Smart Field Detection**: Automatically finds and fills subject and body fields
- **Gmail API Integration**: Optional integration with Gmail API for few-shot learning from previous emails

### 💾 Data Management
- **Session Persistence**: Saves your last generated email and settings
- **Auto-restore**: Restores previous session data when reopening the extension
- **Reset Functionality**: Easy reset of all inputs and generated content

## Installation

### Prerequisites
1. **Ollama**: Install and run Ollama on your local machine
   ```bash
   # Install Ollama (macOS)
   brew install ollama
   
   # Start Ollama service
   ollama serve
   
   # Pull a model (example)
   ollama pull llama3.2:latest
   ```

2. **Chrome Browser**: Chrome or Chromium-based browser

### Extension Setup
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the DraftMail folder
5. The extension should now appear in your Chrome toolbar

### Gmail API Setup (Optional)
For enhanced features using Gmail API:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Update the `client_id` in `manifest.json`

## Usage

### Basic Workflow
1. **Open DraftMail**: Click the extension icon in your Chrome toolbar
2. **Select AI Model**: Choose from available Ollama models
3. **Set Recipient Type**: Select the type of recipient (professor, staff, recruiter, etc.)
4. **Choose Writing Style**: Select one or more writing styles
5. **Add Notes**: Enter key points, requests, or deadlines
6. **Select Language**: Choose Korean or English
7. **Generate**: Click "✨ 초안 생성" to generate the email draft
8. **Insert**: Click "📧 Gmail에 삽입" to insert into Gmail

### Advanced Features
- **Gmail API Integration**: Enable to use previous emails as examples for better context
- **Custom Categories**: Add custom recipient types for specific use cases
- **Style Combinations**: Mix and match different writing styles
- **Session Recovery**: Automatically restore your last session when reopening

## Project Structure

```
DraftMail/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI interface
├── popup.js              # Popup logic and UI interactions
├── background.js          # Background service worker for API calls
├── contentScript.js       # Gmail integration script
├── options.html           # Settings page
├── options.js             # Settings page logic
├── styles.css             # UI styling
└── icons/                 # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Technical Details

### Architecture
- **Manifest V3**: Uses the latest Chrome extension manifest version
- **Service Worker**: Background script handles API communication
- **Content Scripts**: Inject functionality into Gmail pages
- **Local Storage**: Chrome storage API for data persistence

### API Integration
- **Ollama API**: Local AI model inference
- **Gmail API**: Optional integration for email history
- **Chrome APIs**: Extension, storage, and identity APIs

### Security
- **Local Processing**: All AI processing happens locally
- **Minimal Permissions**: Only requests necessary permissions
- **No Data Collection**: No user data is sent to external servers

## Development Status

### ✅ Completed Features
- [x] Basic email generation with Ollama
- [x] Gmail integration and auto-insertion
- [x] Multiple AI model support
- [x] Writing style customization
- [x] Language selection (Korean/English)
- [x] Session persistence
- [x] UI/UX implementation
- [x] Error handling and user feedback

### 🚧 In Progress
- [ ] Gmail API integration for few-shot learning
- [ ] Enhanced error handling
- [ ] Performance optimizations

### 📋 Planned Features
- [ ] Additional language support
- [ ] Email template management
- [ ] Advanced prompt customization
- [ ] Batch email generation
- [ ] Integration with other email providers

## Troubleshooting

### Common Issues
1. **Ollama Connection Failed**
   - Ensure Ollama is running: `ollama serve`
   - Check if models are installed: `ollama list`
   - Verify localhost:11434 is accessible

2. **Gmail Insertion Failed**
   - Ensure you're on Gmail compose page
   - Try refreshing the page and retrying
   - Check if Gmail compose window is open

3. **Extension Not Working**
   - Reload the extension in chrome://extensions/
   - Check browser console for errors
   - Verify all files are properly loaded

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is open source. Please check the license file for details.

## Version

Current version: 0.1.0

---

**Note**: This extension requires Ollama to be running locally. Make sure to install and start Ollama before using the extension.
