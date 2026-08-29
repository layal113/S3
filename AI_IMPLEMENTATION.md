# AI Implementation & Model Architecture

## 1. Executive Summary

Miqyas integrates a dual-tier artificial intelligence pipeline:
1. **Statistical Machine Learning Layer (NILM Disaggregation)**: An ensemble of tree-based classifiers that dissects aggregate smart meter power signals into individual appliance consumption categories.
2. **Generative AI Advisory Layer (LLM Personalization)**: A server-side integration with Google Gemini that transforms disaggregated telemetry into actionable, context-aware energy-saving strategies and conversational recommendations.

---

## 2. Appliance Disaggregation Machine Learning Model

### 2.1 Problem Formulation
Non-Intrusive Load Monitoring (NILM) addresses the problem of inferring the power draw and operating states of individual home appliances from a single aggregated whole-house power signal measured at the utility meter. 

In the Miqyas backend, disaggregation is framed as a supervised multi-label binary classification problem evaluated over rolling sliding windows:
$$\hat{y}_c(t) = f_c(\mathbf{x}_t), \quad c \in \{\text{fridge}, \text{lighting}, \text{ac\_hvac}, \text{other}\}$$
where $\mathbf{x}_t \in \mathbb{R}^8$ represents the 8-dimensional feature vector extracted over a 15-minute rolling window around timestamp $t$, and $f_c$ is the dedicated model for appliance category $c$.

### 2.2 Why Random Forest?
A Random Forest Classifier was selected over deep neural architectures (such as Sequence-to-Sequence CNNs or Recurrent Neural Networks) based on core engineering tradeoffs:
- **Tabular & Non-Linear Feature Suitability**: Tree ensembles natively partition continuous power signals and capture non-linear step-changes (e.g. compressor cycle starts vs. baseline standby noise) without requiring deep feature representations.
- **Invariance to Monotonic Transformations & Scaling**: Random Forests do not require complex feature normalization or gradient optimization tuning, ensuring consistent inference stability across variable household baselines.
- **Low-Latency, Database-Free Inference**: Frozen `.joblib` model binaries load into memory in under 50 milliseconds and execute inference in under 5 milliseconds per 15-minute window, permitting cost-effective deployment on memory-constrained compute environments.

### 2.3 GroupKFold Cross-Validation by Household
In time-series NILM data, standard random row splitting causes severe data leakage: consecutive 1-minute samples within the same household share nearly identical environmental, temporal, and load state characteristics. Randomly splitting rows between training and test sets produces artificially inflated accuracy scores that collapse when the model is presented with a new, unseen household.

To ensure genuine out-of-distribution evaluation, training utilized **House-Based GroupKFold Validation**:
- Data was partitioned by physical household identifiers (`UKDALE_house_1` through `UKDALE_house_5`, and `IAWE_house_1` through `IAWE_house_2`).
- Models were trained exclusively on a subset of households and evaluated strictly on separate, held-out households during each validation fold.
- This methodology evaluates whether the model learned generalized appliance electrical signatures rather than memorizing the baseline noise of a specific dwelling.

### 2.4 Interpretation of `model_score` vs. "Confidence"
In all API schemas ([ApplianceBreakdownItem](file:///a:/S3/api/schemas.py#L14-L28)), the output metric is explicitly named `model_score`, not "confidence" or "accuracy":
- **Technical Definition**: `model_score` represents the raw, uncalibrated class probability output by the classifier ensemble ($\frac{1}{N_{\text{trees}}} \sum \hat{p}_i$).
- **Score Labeling**:
  - `High`: Raw score $\ge 0.70$
  - `Medium`: Raw score between $0.40$ and $0.70$
  - `Low`: Raw score $< 0.40$
  - `N/A`: Category untrained (`not_yet_trained: true`)
- **Engineering Justification**: Labeling raw probabilities as "calibrated confidence" or "accuracy" is mathematically misleading. A probability output of 0.80 means 80% of decision trees voted for the active state; it does not constitute an empirical measurement guarantee.

### 2.5 Explicit Transparency for Untrained Categories (`water_heater`)
The `water_heater` category is intentionally not modeled due to the complete absence of verified ground truth water heater telemetry in the baseline benchmark datasets.

Rather than generating fabricated predictions, interpolating synthetic numbers, or silently folding the load into `other`, the API explicitly returns:
```json
{
  "category": "Water heater",
  "internalCategory": "water_heater",
  "displayName": "Water heater",
  "consumptionKwh": 0.0,
  "sharePercent": 0.0,
  "modelScore": 0.0,
  "modelScoreLabel": "N/A",
  "notYetTrained": true
}
```
This guarantees complete transparency for auditors and end users.

---

## 3. Generative AI Advisory Layer (Google Gemini)

### 3.1 Architecture & Endpoints
The Generative AI layer exposes two endpoints in [api/main.py](file:///a:/S3/api/main.py):
1. `POST /v1/smart-tips/generate`: Produces exactly 4 targeted, prioritized energy reduction actions.
2. `POST /v1/smart-tips/chat`: Enables multi-turn contextual advisory conversations regarding specific tips.

### 3.2 Data Ingestion & Sanitization
The AI layer never receives raw sensor time-series data or personally identifiable information (PII). It receives only structured household summaries:
- **Dwelling Profile**: Property type (Apartment/Villa) and occupant count.
- **Consumption Statistics**: Average daily kWh and peak consuming time intervals.
- **Detected Load Patterns**: Specific appliance breakdown percentages (e.g. "Air Conditioning represents 58% of active load").
- **Tariff Risk**: Egyptian residential tariff tier proximity (e.g. approaching the 350 kWh or 650 kWh bracket cliff).

### 3.3 Strict JSON Schema Enforcement
The prompt executes with `responseMimeType: "application/json"` and an enforced `responseSchema` constraint:
- Requires an array of exactly 4 unique tips.
- Restricts category keys to `["heating", "cooling", "appliances", "lighting", "behavior"]`.
- Enforces strict title brevity (maximum 6 words).
- Validates the response via Pydantic model validation (`SmartTipsResponse.model_validate_json`) with fallback error handling.

### 3.4 Operational Controls
- **API Key Isolation**: `GEMINI_API_KEY` is loaded strictly on the backend via `os.getenv()` and is never exposed in mobile client bundles.
- **Rate Limiting**: Protected with `@limiter.limit("10/minute")` via `slowapi` to prevent API quota exhaustion and denial-of-service abuse.

---

## 4. Counterfactual Analysis: What Happens If AI Is Removed?

### 4.1 If the Machine Learning Disaggregation Component Is Removed
- **Loss of Appliance Visibility**: The system degrades from an intelligent diagnostic platform to a basic digital energy meter. Users receive only a single aggregated number (total monthly kWh).
- **Elimination of Tariff Mitigation**: Users cannot determine *which* appliance is driving them toward a higher tariff bracket. They cannot tell whether their 450 kWh bill is caused by an inefficient refrigerator thermostat, continuous standby loads, or heavy air conditioner runtimes.
- **Breakdown of Actionable Heuristics**: Dynamic recommendations (such as raising AC thermostat by 1-2°C or checking refrigerator seals) become impossible because the system cannot identify the primary load contributor.

### 4.2 If the Generative AI (Gemini) Advisory Component Is Removed
- **Loss of Dynamic Contextual Advice**: The application falls back entirely to static, hardcoded rule templates. The recommendations cannot adapt to occupant count, specific dwelling types, or anomalous seasonal usage spikes.
- **Elimination of Interactive Follow-Up**: Homeowners cannot ask clarifying questions about implementation costs, alternative strategies, or tenant-specific options for their homes.
- **Diminished User Engagement**: Without conversational, context-specific insights, long-term user retention and sustained behavioral energy reduction drop significantly.
