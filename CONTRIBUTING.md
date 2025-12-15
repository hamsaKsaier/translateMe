# Contributing to TranslateMe

Thank you for your interest in contributing to TranslateMe! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/translateMe.git
   cd translateMe
   ```

3. **Set up your development environment:**
   - Install dependencies: `npm install`
   - Copy configuration example files:
     ```bash
     cp config/supabase.config.example.js config/supabase.config.js
     cp config/api.config.example.js config/api.config.js
     ```
   - Configure your credentials (see [README.md](README.md) for details)

4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

Before you can run the extension, you need to set up:

1. **Supabase Configuration** (`config/supabase.config.js`):
   - Create a Supabase account and project
   - Copy your project URL and anonymous key
   - Update `config/supabase.config.js` with your credentials

2. **API Configuration** (`config/api.config.js`):
   - Get a free API key from [OpenRouter](https://openrouter.ai/) or [Groq](https://console.groq.com/keys)
   - Update `config/api.config.js` with your API key

3. **Google OAuth** (`manifest.json`):
   - Set up Google OAuth credentials
   - Replace `YOUR_GOOGLE_OAUTH_CLIENT_ID` in `manifest.json`

**Important:** Never commit your actual configuration files with real credentials. These files are gitignored for security.

## Making Changes

1. **Follow the code style** - Use consistent formatting and naming conventions
2. **Write clear commit messages** - Describe what and why, not how
3. **Test your changes** - Make sure the extension works as expected
4. **Update documentation** - If you add features, update the README

## Submitting Changes

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

2. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub:
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template with details about your changes

## Code Guidelines

- **Security First**: Never hardcode API keys, secrets, or credentials
- **Error Handling**: Always handle errors gracefully with user-friendly messages
- **Comments**: Add comments for complex logic, but keep code self-documenting
- **Testing**: Test your changes on multiple websites and scenarios

## Reporting Issues

If you find a bug or have a feature request:

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Browser and extension version

## Questions?

Feel free to open a discussion on GitHub or reach out to the maintainers.

Thank you for contributing to TranslateMe! 🎉
