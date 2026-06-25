# Contributing to Tantalum Web App

First off, thank you for considering contributing to Tantalum! It's people like you that make open-source a great community.

## 🤝 Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be welcoming, inclusive, and respectful to all community members.

## 🛠 How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an issue describing:
- What you were trying to do.
- What happened.
- What you expected to happen.
- Steps to reproduce the issue.
- Your environment (OS, Browser, Node version).

*Note: If you find a security vulnerability, do NOT open an issue. Please read [SECURITY.md](SECURITY.md).*

### Suggesting Enhancements
Enhancement suggestions are tracked as GitHub issues. Please provide:
- A clear and descriptive title.
- A detailed description of the proposed enhancement.
- Why this enhancement would be useful to most users.

### Pull Requests
1. Fork the repository and create your branch from `main`.
2. Ensure you have installed the necessary dependencies (`npm install`).
3. Make your changes.
4. Test your changes locally to ensure everything works as expected.
5. Make sure your code adheres to the existing style guidelines.
6. Issue that pull request!

## 💻 Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/tantalum.git
   cd tantalum/tantalum-web-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 📝 Commit Messages

We loosely follow Conventional Commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding or updating tests
- `chore:` for tooling or configuration changes

Example: `feat: add user profile page`

Thank you for contributing!
