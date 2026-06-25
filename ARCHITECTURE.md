# Architecture

This document provides a high-level overview of the Tantalum Web App architecture.

## 🏗 High-Level Overview

Tantalum Web App is a modern monolithic frontend built with **Next.js 15** utilizing the **App Router** paradigm. It leverages **Appwrite** as a Backend-as-a-Service (BaaS) for authentication, databases, and storage.

The app serves four primary domains:
1. **Marketing Page:** Public-facing, SEO-optimized landing pages.
2. **Auth Portal:** Login, registration, password recovery.
3. **User Dashboard:** The primary interface for authenticated users.
4. **Admin Panel:** Secured routes for system administrators to manage the platform.

## 📁 Directory Structure

```text
tantalum-web-app/
├── app/                  # Next.js App Router (Routes, Pages, Layouts)
├── components/           # Reusable React components (UI, Layout, Domain-specific)
├── lib/                  # Utility functions, API clients, and Appwrite initialization
├── styles/               # Global CSS and Tailwind configuration
├── public/               # Static assets (images, fonts, icons)
├── scripts/              # Infrastructure and build scripts (e.g., Appwrite config)
└── appwrite.config.json  # Configuration for Appwrite resources
```

## 🔌 Technology Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Library:** [React 19](https://react.dev/)
- **Backend/Database:** [Appwrite](https://appwrite.io/) (v13+)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** TypeScript

## 🗄 Backend Integration (Appwrite)

The application communicates with Appwrite exclusively via the official Appwrite Web SDK.

- **Authentication:** Appwrite handles session management. Client components verify active sessions to conditionally render protected routes.
- **Database:** Appwrite databases and collections store all user and application data.
- **Configuration:** The `scripts/configure-appwrite-site.mjs` script acts as a lightweight Infrastructure-as-Code (IaC) tool, reading `appwrite.config.json` to automatically provision necessary collections, attributes, and indexes during setup.

## 🛡 Routing & Security

Next.js App Router handles all routing.
- **Public Routes:** `/`, `/about`, `/pricing`, `/login`, `/register`.
- **Protected Routes:** `/dashboard/*` (requires active Appwrite session).
- **Admin Routes:** `/admin/*` (requires active session + specific admin team/role membership in Appwrite).

Data fetching is done safely, with sensitive operations and secret keys kept securely on the server environment.
