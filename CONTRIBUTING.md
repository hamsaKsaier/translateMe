# Contributing to TranslateMe

Thank you for your interest in contributing to TranslateMe! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with:
- A clear description of the bug
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and extension version
- Screenshots if applicable

### Suggesting Features

We welcome feature suggestions! Please open an issue with:
- A clear description of the feature
- Use cases and benefits
- Any implementation ideas (optional)

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Test thoroughly** - ensure the extension works in Chrome
5. **Commit your changes** (`git commit -m 'Add amazing feature'`)
6. **Push to your branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

## Development Guidelines

### Code Style

- Follow existing code style and patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and single-purpose

### Testing

- Test your changes in Chrome browser
- Test with different websites and languages
- Verify keyboard shortcuts and context menu work
- Check that authentication flow works correctly

### File Structure

- Keep related files together
- Follow the existing directory structure
- Update documentation if you change functionality

## Setup for Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure Supabase (see `AUTH_SETUP.md`)
4. Create `config/api.config.js` from `config/api.config.example.js`
5. Load the extension in Chrome as unpacked

## Important Notes

- **Never commit** `config/api.config.js` or `config/supabase.config.js` (they contain API keys)
- Update version in `manifest.json` for significant changes
- Update `README.md` if you add new features or change setup instructions

## Questions?

Feel free to open an issue for questions or discussions. We're happy to help!

Thank you for contributing to TranslateMe! 🎉
