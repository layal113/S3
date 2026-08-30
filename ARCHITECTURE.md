# System Architecture

## 1. Architectural Overview

Miqyas (S3) is an end-to-end energy intelligence platform engineered to mitigate progressive electricity tariff penalties for Egyptian residential consumers. The system is architected around a decoupled client-server model: a mobile/web cross-platform client built on React Native and Expo, and a high-throughput machine learning inference and API layer built on FastAPI.

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Expo / React Native / TypeScript)"]
        UI[Mobile & Web Dashboard UI]
        ClientService[Dashboard & Telemetry Services]
        UI --> ClientService
    end

    subgraph Gateway ["API & Gateway Layer (FastAPI / Uvicorn)"]
        Router[FastAPI Route Handlers]
        AuthSec[CORS & slowapi Rate Limiter]
        LoggingMW[HTTP Request Logger & Trace Injector]
        SentryCore[Sentry SDK Error & Performance]
        
        ClientService -->|HTTP JSON| Router
        Router --- AuthSec
        Router --- LoggingMW
        Router --- SentryCore
    end

    subgraph CoreServices ["Backend Processing & Domain Layer"]
        SimLayer["Simulator Layer<br/>(generate_household.py)"]
        MLInference["ML Disaggregation Engine<br/>(model/predict.py)"]
        TariffEngine["Tariff & Billing Projection Engine<br/>(Egyptian Residential Schedule)"]
        GeminiLayer["AI Advisory Layer<br/>(Smart Tips & Advisory Chat)"]

        Router -->|/simulate-usage| SimLayer
        Router -->|/get-breakdown| MLInference
        Router -->|/get-recommendation| MLInference
        Router -->|/v1/households/{id}/dashboard| TariffEngine
        Router -->|/appliances/usage| MLInference
        Router -->|/usage/history| TariffEngine
        Router -->|/health| MLInference
        Router -->|/v1/smart-tips/*| GeminiLayer

        MLInference --> TariffEngine
        TariffEngine --> GeminiLayer
    end

    subgraph StorageArtifacts ["Artifacts & Models"]
        ModelFiles[("Joblib Model Artifacts<br/>(fridge, lighting, ac, other)")]
        ModelMeta[("metadata.json<br/>(taxonomies & thresholds)")]
        MLInference --> ModelFiles
        MLInference --> ModelMeta
    end

    subgraph ExternalServices ["External Cloud Services"]
        GeminiAPI["Google Gemini API<br/>(gemini-3.1-flash-lite)"]
        SentryCloud["Sentry SaaS Dashboard<br/>(Issues & Tracing)"]
        
        GeminiLayer -->|Server-to-Server HTTPS| GeminiAPI
        SentryCore -->|Distributed Tracing & Events| SentryCloud
    end
```

---

## 2. Component Specifications

### 2.1 Client Application (`src/`)
- **Technology**: React Native, Expo SDK 57, TypeScript.
- **Role**: Renders real-time telemetry, appliance breakdown distributions, historical consumption trends, tariff bracket status, and conversational energy-saving advice.
- **State and Network Management**: Dispatches typed asynchronous API requests via `src/services/` to endpoints configured in `src/config/env.ts` (with automated Android Emulator host loopback resolution to `10.0.2.2:8000`).

### 2.2 API and Gateway Layer (`api/main.py`)
- **Technology**: FastAPI, Starlette, Uvicorn, slowapi, Sentry SDK.
- **Middleware**:
  - `CORSMiddleware`: Governs cross-origin requests across mobile dev clients and web hosts.
  - `log_http_request`: Injects a unique `x-request-id` into every incoming request, logs request paths, client IPs, and precise response execution durations in milliseconds.
  - `slowapi.Limiter`: Enforces IP-based rate limiting (10 requests/minute) specifically on compute- and quota-intensive AI endpoints.
  - `sentry_sdk`: Captures unhandled runtime exceptions, profiles active request transactions, and records diagnostic spans.

### 2.3 Machine Learning Inference Layer (`model/predict.py`)
- **Technology**: scikit-learn (RandomForestClassifier ensembles), pandas, numpy, joblib.
- **Role**: Ingests rolling windows of aggregate mains power readings (minimum 15 1-minute samples), calculates 8 temporal and statistical features, and produces probabilistic appliance classification for refrigerator, lighting, air conditioning, and other loads.
- **Artifact Management**: Loads frozen binary classifiers (`*_model.joblib`) and validation metadata (`metadata.json`) directly from `model/artifacts/` without requiring an external database.

### 2.4 Synthetic Household Signal Generator (`simulator/generate_household.py`)
- **Technology**: pandas, numpy.
- **Role**: Emulates realistic time-series smart meter telemetry for Egyptian households, incorporating distinct appliance duty cycles (fridge cycling, evening lighting bumps, intermittent spikes, and high compressor AC loads).

### 2.5 AI Advisory Layer (`api/main.py`)
- **Technology**: Google Gemini API via secure server-side execution (`urllib.request`).
- **Role**: Formulates structured, context-aware energy-saving guidance based on measured consumption profiles, detected anomalies, and Egyptian progressive tariff bracket proximity.

---

## 3. Real Endpoint Inventory

| Method | Endpoint Path | Subsystem | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Core Gateway | Root health and service identity verification. |
| `GET` | `/health` | Observability | Verifies service status and validates that all `.joblib` model artifact files are loaded on disk. |
| `POST` | `/simulate-usage` | Simulator | Generates synthetic multi-appliance time-series telemetry matching realistic load profiles. |
| `GET` / `POST` | `/get-breakdown` | ML Inference | Disaggregates raw aggregate power readings into category-specific kWh shares and model scores. |
| `GET` | `/get-recommendation` | Heuristics | Returns prioritized energy-saving action based on the highest active consumption load. |
| `GET` | `/v1/households/{household_id}/dashboard` | Aggregation | Consolidated dashboard payload containing metrics, tariff status, appliance breakdown, and recommendations. |
| `GET` | `/appliances/usage` | ML Inference | Appliance-level energy consumption history and proportional distributions. |
| `GET` | `/usage/history` | Telemetry | Time-series historical consumption grouped by day, week, or billing cycle. |
| `POST` | `/v1/smart-tips/generate` | Gemini AI | Generates 4 customized energy-efficiency recommendations (Rate-limited: 10/min). |
| `POST` | `/v1/smart-tips/chat` | Gemini AI | Contextual chat assistant for deep-diving into specific tip implementation (Rate-limited: 10/min). |
| `GET` | `/sentry-debug` | Monitoring | Diagnostic route triggering an unhandled 500 error for Sentry transaction verification. |
| `GET` | `/sentry-capture-test` | Monitoring | Diagnostic route testing manual error reporting via `sentry_sdk.capture_exception`. |

---

## 4. End-to-End Data Flow

1. **Telemetry Ingestion**: The client collects or simulates 1-minute smart meter power readings (Watts) and posts them to `/get-breakdown` or `/v1/households/{id}/dashboard`.
2. **Feature Pipeline**: The backend validates that at least 15 contiguous readings are present, then extracts rolling statistical means, standard deviations, power deltas, and temporal indicators.
3. **Appliance Disaggregation**: Ensembles of binary Random Forest classifiers evaluate the extracted feature vectors. Outputs are filtered through empirical decision thresholds to assign energy to Refrigerator, Lighting, AC/HVAC, and Other categories, with residual consumption allocated to Unattributed Baseline.
4. **Tariff Projection**: Aggregate kWh is extrapolated across the active monthly billing cycle against Egyptian residential tariff brackets (50, 100, 200, 350, 650, and 1000 kWh) to evaluate threshold cliff risks.
5. **AI Personalization**: When requested, Gemini receives the sanitized household telemetry summary, peak load hours, and tariff status to generate targeted Arabic/English reduction actions.
6. **Telemetry & Monitoring**: Request latency, status codes, and exceptions are forwarded asynchronously to Sentry.
