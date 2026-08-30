# S3 (Miqyas) - AI Home Energy Usage Optimizer

## Overview
Miqyas is an intelligent home energy analytics and disaggregation platform engineered specifically for Egyptian residential consumers. In Egypt, residential electricity billing follows a steep progressive tier structure where exceeding monthly consumption thresholds triggers retroactive price re-evaluations across entire billing cycles (the "tariff-cliff" problem). Miqyas continuously disaggregates aggregate smart meter power readings into appliance-level consumption, forecasts end-of-month bracket crossings, and generates actionable, AI-driven mitigation recommendations before costly tier transitions occur.

## Tech Stack
- Backend: FastAPI (Python 3.11+)
- Machine Learning: scikit-learn (RandomForestClassifier with 15-minute rolling feature extraction), pandas, numpy, joblib
- Frontend: React Native, Expo SDK 57, TypeScript
- AI Advisory Layer: Google Gemini API via server-side orchestration
- Observability and Error Monitoring: Sentry SDK
- Training Datasets: Public Non-Intrusive Load Monitoring (NILM) research benchmarks (REDD, UK-DALE, IAWE)

## Prerequisites
- Python 3.11 or newer
- Node.js 18 LTS or newer
- npm or yarn
- Google Gemini API key (https://aistudio.google.com)

## Environment Variables
Create a `.env` file in the project root based on `.env.example`:

```env
# Frontend environment variables (publicly accessible in client bundle)
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000

# Backend-only environment variables (never exposed to client)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
SENTRY_DSN=your_sentry_dsn_here
```

## Installation

### Backend
```bash
pip install -r requirements.txt
```

### Frontend
```bash
npm install
```

## Running Locally

### 1. Start the Backend Service
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API documentation is accessible at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 2. Start the Frontend Application
```bash
# Start for Web
npm run web

# Start for Android Emulator
npm run android

# Start for iOS Simulator
npm run ios

# Start via Expo Tunnel (for physical device via Expo Go)
npx expo start --tunnel
```

Note: When running on the Android Emulator, `src/config/env.ts` automatically maps host network requests to `http://10.0.2.2:8000`.

## Running Tests

### Backend Test Suite
```bash
pytest tests/ -v
```

### Frontend Quality and Type Verification
```bash
# TypeScript type check
npm run typecheck

# ESLint static analysis
npm run lint

# Prettier format check
npm run format:check
```

## Project Structure
```text
/
├── .github/workflows/   # CI/CD pipelines (GitHub Actions)
├── api/                 # FastAPI routes, Pydantic schemas, and middleware
├── data/                # Dataset definitions, taxonomy mapping, and ETL utilities
├── model/               # ML feature engineering, inference pipeline, and model artifacts
├── simulator/           # Time-series synthetic household signal generator
├── src/                 # React Native / Expo application
│   ├── components/      # Modular UI presentation components
│   ├── config/          # Environment resolution and API endpoints
│   ├── navigation/      # React Navigation bottom-tab structure
│   ├── screens/         # Application screens (Home, Insights, Profile)
│   ├── services/        # API client and telemetry integration
│   ├── theme/           # Design tokens, typography, and color palettes
│   └── types/           # Shared TypeScript interfaces and schemas
├── tests/               # Pytest suite for API endpoints, ML inference, and simulator
├── Dockerfile           # Production container definition for Render deployment
└── requirements.txt     # Python backend dependencies
```

## System Architecture

```text
+-----------------------+         +-------------------------------+
|  React Native Client  | <-----> |   FastAPI Backend Service     |
|   (Expo / TypeScript) |   HTTP  |      (Port 8000 / Uvicorn)    |
+-----------------------+         +---------------+---------------+
                                                  |
                         +------------------------+------------------------+
                         |                        |                        |
                         v                        v                        v
             +-----------------------+  +-------------------+  +-----------------------+
             |   NILM Disaggregator  |  |  Gemini AI Layer  |  |  Sentry Observability |
             | (Rolling Features/RF) |  | (Server-side API) |  | (Trace & Error Logs)  |
             +-----------------------+  +-------------------+  +-----------------------+
```

1. Signal Ingestion: Aggregated mains power readings (1-minute intervals) are processed in rolling 15-minute windows.
2. Disaggregation Inference: Feature engineering extracts statistical distributions, spectral indicators, and cycle deltas to classify appliance loads (refrigerator, lighting, air conditioner, and unattributed baseline).
3. Tariff Analytics: Predicts total monthly consumption against the Egyptian residential electricity tariff schedule to identify threshold risk.
4. AI Advisory: Gemini creates contextualized recommendations based on identified peak load drivers.
5. Observability: Sentry captures unhandled errors, distributed traces, and manual diagnostics.

## Known Limitations
- The `water_heater` appliance category is not yet trained due to absence of verified ground truth signatures in the baseline dataset combination. It is explicitly returned with `not_yet_trained: true` and `modelScore: 0.0` rather than emitting synthetic or fabricated values.
- ML classification baselines are calibrated on benchmark NILM datasets (REDD, UK-DALE, IAWE). Field calibration with empirical Egyptian smart meter data is scheduled for Phase 1 pilot validation.
- Signal feature extraction requires a minimum rolling window of 15 readings (15 minutes). Requests containing fewer than 15 readings are rejected with HTTP 400 to prevent degraded inference quality.

## Deployment
- Backend: Deployed on Render using the provided `Dockerfile`.
- Frontend: Expo web bundle built as a Render Static Site with a SPA rewrite rule to serve `/index.html` for browser refreshes and deep links.
