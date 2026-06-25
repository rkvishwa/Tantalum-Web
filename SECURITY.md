# Security Policy

Security is a top priority for the Tantalum project. This document outlines our security policies and how to report vulnerabilities.

## 🛡 Supported Versions

We currently provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

*(Note: Ensure you are always running the latest minor/patch release of your major version to receive security updates).*

## 🚨 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you believe you have found a security vulnerability in the Tantalum Web App or any of its associated services, please report it to us as quickly as possible.

1. Email your findings to **[hello@knurdz.org](mailto:hello@knurdz.org)**.
2. Include a descriptive subject line (e.g., "Security Vulnerability: [Brief Description]").
3. Provide as much detail as possible, including:
   - The type of vulnerability (e.g., XSS, SQLi, CSRF).
   - Steps to reproduce the vulnerability.
   - Any potential impact or risk assessment.
   - Proof of Concept (PoC) code or screenshots if available.

### What to Expect
- We will acknowledge receipt of your vulnerability report within 48 hours.
- We will send you regular updates about our progress investigating and resolving the issue.
- Once the issue is resolved, we will publish a security advisory and credit you for the discovery (unless you prefer to remain anonymous).

## 🔒 Best Practices for Self-Hosting

If you are self-hosting Tantalum:
- Always use HTTPS/SSL for your web server and Appwrite instance.
- Keep your Next.js and Appwrite versions up to date.
- Regularly rotate your Appwrite API keys.
- Follow the Principle of Least Privilege when assigning roles in your Appwrite instance.

Thank you for helping us keep the Tantalum community safe!
