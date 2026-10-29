# WristBand — Intelligent Women's Safety & Emergency Response System

WristBand is a women's safety application designed to provide access to emergency assistance, personal safety tools, evidence storage, and travel safety features.

## Project Structure

This repository contains two implementations of WristBand:

| Folder | Description | Status |
|---|---|---|
| `web-app/` | React and TanStack Start application. Stores application data in the browser. | Runs locally; backend integration requires further work. |
| `frontend/` + `backend/` + `database/` | Vanilla JavaScript frontend, Python Flask REST API, and Supabase integration structure. | Supports local development; production use requires configuration and testing. |

## Quick Start — React Application

```bash
cd web-app
npm install
npm run dev
```

Open the local URL displayed in the terminal.

## Quick Start — Flask Application

Configure the environment and install the backend dependencies:

```bash
python -m venv .venv
```

On Git Bash for Windows, activate the environment with:

```bash
source .venv/Scripts/activate
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

Configure the environment variables using `.env.example`. For local testing, review the supported backend configuration in the setup documentation.

Start the Flask backend from the `backend/` directory using the documented application entry point. Serve the `frontend/` directory separately and open its login page in your browser.

## Database Setup

Configure your Supabase project before using the application with a real database. Apply the SQL migrations in order from `database/migrations/` using the appropriate Supabase workflow.

Refer to `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/DEPLOYMENT.md` for project guidance.

## Features and Limitations

The repository includes dashboard, SOS, emergency contacts, evidence vault, travel journeys, device management, and administrative functionality in the Flask implementation.

- SMS notifications require valid Twilio credentials.
- Real database functionality requires Supabase configuration.
- Phone calls and emergency-services dispatch are not implemented.
- Background GPS tracking when the browser is closed is not implemented.
- Location access depends on browser permissions and the page remaining open.

Features and integrations must be tested in the configured environment before production use.

## Security

Never commit real passwords, API keys, access tokens, or other secrets to GitHub. Keep credentials in environment variables and exclude local `.env` files from version control.
