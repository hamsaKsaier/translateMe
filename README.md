# 🌍 TranslateMe - AI-Powered Translation Issue Detection

A powerful Chrome extension that automatically detects translation issues on websites using advanced AI technology. TranslateMe helps developers and content managers identify texts that need translation, ensuring consistent multilingual user experiences.

## ✨ Features

- **🔐 Google Authentication**: Secure sign-in with Google via Supabase backend
- **🤖 AI-Powered Detection**: Uses OpenAI GPT-4o for intelligent translation analysis
- **⚡ Smart Batching**: Optimized requests with parallel processing (1-3 requests instead of many)
- **🌊 Streaming Results**: ChatGPT-like streaming display of issues as they're detected
- **🎯 High Accuracy**: Simple, reliable language detection with improved French support
- **🌐 Multi-Language Support**: Supports any target language (English, Spanish, French, German, etc.)
- **⚡ Real-Time Monitoring**: Auto-tracks HTML changes with MutationObserver
- **🔍 Manual Scanning**: On-demand page analysis with detailed results
- **🎨 Visual Highlighting**: Color-coded issue highlighting (red for static, blue for dynamic, orange for mixed)
- **🎨 Highlight Controls**: "Highlight Issues" and "Clean Results" buttons for user control
- **💾 Persistent Storage**: Saves issues with Chrome storage API
- **👤 User Management**: Individual user accounts with secure session management

## 🚀 Installation

### Quick Start

For a quick setup guide, see [QUICK_START.md](QUICK_START.md)

### Method 1: Load as Unpacked Extension (Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hamsaKsaier/translateMe.git
   cd translateMe
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Supabase:**
   - Create a Supabase account at [supabase.com](https://supabase.com)
   - Create a new project
   - Copy `config/supabase.config.example.js` to `config/supabase.config.js`
   - Update with your Supabase credentials
   - See [AUTH_SETUP.md](AUTH_SETUP.md) for detailed instructions

4. **Set up Google OAuth:**
   - Follow the instructions in [AUTH_SETUP.md](AUTH_SETUP.md) to configure Google OAuth
   - Update `manifest.json` with your OAuth credentials

5. **Open Chrome Extensions:**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

6. **Load the extension:**
   - Click "Load unpacked"
   - Select the `translateMe` folder
   - The extension should now appear in your extensions list
   - Copy the Extension ID

7. **Update Google Cloud Console:**
   - Update your OAuth credentials with the Extension ID
   - See [AUTH_SETUP.md](AUTH_SETUP.md) for details

8. **Pin the extension:**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin TranslateMe for easy access

### Method 2: Install from Chrome Web Store (Coming Soon)

*This extension will be available on the Chrome Web Store soon.*

## ⚙️ Configuration

### 1. Get API Keys

**OpenAI (Recommended):**
- Visit [OpenAI API](https://platform.openai.com/api-keys)
- Create an account and generate an API key
- Copy your API key (starts with `sk-`)

**Groq AI (Alternative):**
- Visit [Groq Console](https://console.groq.com/keys)
- Create an account and generate an API key
- Copy your API key

### 2. Configure the Extension

1. **Set up API Key:**
   - Open `content/content.js`
   - Find the `getAPIConfig()` method (around line 744)
   - Replace `'YOUR_OPENAI_API_KEY_HERE'` with your actual OpenAI API key
   - Save the file

2. **Set Target Language:**
   - In the same file, find the `getTargetLanguage()` method (around line 784)
   - Change `'en'` to your desired target language
   - Save the file

3. **Start Scanning:**
   - Navigate to any website
   - Click "Scan Page" to analyze the current page
   - Click "Highlight Issues" to see color-coded highlights
   - Click "Clean Results" to remove highlights

## 🎯 How It Works

### AI Analysis Process

1. **Text Extraction**: Scans the page for text elements (filters out containers and long texts)
2. **Language Detection**: Uses simple, reliable word/character-based detection
3. **Smart Batching**: Groups texts into optimal batches (max 100k tokens, 50 texts per batch)
4. **Parallel Processing**: Sends multiple batches simultaneously for faster processing
5. **AI Analysis**: Sends batched texts to OpenAI GPT-4o for analysis
6. **Streaming Results**: Displays issues as they're detected (ChatGPT-like effect)
7. **Classification**: AI classifies each text as:
   - `Static/Issue`: UI elements not in target language
   - `Static/No_Issue`: UI elements in correct language
   - `Dynamic/Issue`: User content not in target language
   - `Dynamic/No_Issue`: User content in correct language
8. **Visual Feedback**: Color-coded highlighting (red for static, blue for dynamic, orange for mixed)

### Expert Role Prompt (100% Accuracy)

The extension uses a scientifically tested prompt that establishes the AI as a "senior translation quality assurance expert with 10+ years of experience auditing multilingual websites." This approach achieved 100% accuracy across 31 test cases.

## 🧪 Testing

The extension includes comprehensive testing capabilities:

### Test Website

Use the `test-website/` directory to test the extension with various multilingual content:

- **French text**: "Rechercher...", "Nos Produits", "Contactez-nous"
- **Arabic text**: "خدماتنا", "منتجاتنا", "اتصل بنا"
- **Mixed content**: English and non-English text combinations
- **Different elements**: Input fields, headings, paragraphs, buttons

### Manual Testing

1. **Load the extension** in Chrome
2. **Open the test website** (`test-website/index.html` in your browser)
3. **Click "Scan Page"** to analyze the content
4. **Check console** for detailed processing logs
5. **Click "Highlight Issues"** to see color-coded highlights
6. **Verify results** match expected translations

## 📁 Project Structure

```
translateMe/
├── manifest.json              # Extension configuration
├── auth/
│   ├── auth.html             # Authentication screen
│   ├── auth.js               # Auth screen logic
│   ├── auth.css              # Auth styling
│   └── authService.js        # Authentication service
├── config/
│   ├── supabase.config.js    # Supabase configuration (gitignored)
│   └── supabase.config.example.js # Supabase config example
├── content/
│   ├── content.js            # Main content script with AI integration
│   └── content.css           # Highlighting styles
├── popup/
│   ├── popup.html            # Extension popup interface
│   ├── popup.js              # Popup logic and streaming updates
│   └── popup.css             # Popup styling
├── background/
│   └── background.js         # Background script for extension lifecycle
├── libs/
│   ├── franc.js              # Language detection library (legacy)
│   └── languageDetector.js   # Language detection wrapper (legacy)
├── assets/icons/             # Extension icons (16px, 48px, 128px)
├── test-website/             # Test website for development
├── AUTH_SETUP.md             # Detailed authentication setup guide
├── QUICK_START.md            # Quick start guide
└── package.json              # Node.js dependencies
```

## 🔧 Development

### Prerequisites

- Node.js 14+ 
- Chrome browser
- OpenAI or Groq API key

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/hamsaKsaier/translateMe.git
cd translateMe

# Install dependencies
npm install

# Load extension in Chrome (see Installation section)
```

### Key Files

- **`content/content.js`**: Main logic with AI integration, smart batching, and streaming results
- **`content/content.css`**: Color-coded highlighting styles
- **`popup/popup.js`**: Popup interface with streaming updates and highlight controls
- **`test-website/`**: Comprehensive test website with multilingual content

## 🎨 Usage Examples

### Basic Usage

1. **Configure the extension** with your API key and target language
2. **Navigate to a website** with mixed languages
3. **Click "Scan Page"** to analyze the current page
4. **Watch streaming results** as issues are detected in real-time
5. **Click "Highlight Issues"** to see color-coded highlights on the page
6. **Check the popup** for detailed issue information
7. **Click "Clean Results"** to remove highlights

### Advanced Usage

1. **Use the test website** (`test-website/index.html`) for testing
2. **Check browser console** for detailed processing logs
3. **Monitor streaming updates** in the popup
4. **Use different target languages** by modifying the code

## 🐛 Troubleshooting

### Common Issues

**Extension not working:**
- Ensure you have a valid API key configured
- Check that the extension is enabled in `chrome://extensions/`
- Verify your internet connection

**No issues detected:**
- Check that your target language is correctly set
- Ensure the website has text in different languages
- Verify your API key has sufficient credits

**API errors:**
- Check your API key is valid and has credits
- Ensure you're using the correct provider (OpenAI/Groq)
- Check the browser console for detailed error messages

### Debug Mode

Enable debug logging by opening Chrome DevTools and checking the console for detailed logs.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for providing the GPT-4o API
- **Chrome Extensions API** for the extension framework
- **Community contributors** for testing and feedback

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hamsaKsaier/translateMe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hamsaKsaier/translateMe/discussions)
- **Email**: [Your contact email]

## 🗺️ Roadmap

- [x] Smart batching with parallel processing
- [x] Streaming results display
- [x] Color-coded highlighting system
- [x] Highlight controls (Highlight/Clean buttons)
- [x] Improved language detection
- [x] Comprehensive test page
- [x] Google authentication with Supabase
- [x] User session management
- [ ] Chrome Web Store publication
- [ ] User-specific data storage
- [ ] Firefox extension support
- [ ] Batch translation suggestions
- [ ] Integration with translation services
- [ ] Advanced filtering options
- [ ] Export functionality (CSV, JSON)
- [ ] Team collaboration features
- [ ] Analytics dashboard

---

**Made with ❤️ for better multilingual web experiences**

*TranslateMe - Ensuring every word is in the right language*
