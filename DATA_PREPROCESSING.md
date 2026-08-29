# Data Ingestion, Preprocessing & Feature Engineering

## 1. Benchmark Data Sources

The machine learning disaggregation models were developed and trained against publicly accessible benchmark Non-Intrusive Load Monitoring (NILM) research datasets:

1. **UK-DALE (UK Domestic Appliance-Level Electricity)**:
   - Contains whole-house mains and individual appliance sub-metered power recorded at high resolution across 5 UK domestic dwellings over multiple months.
   - Provides primary baseline signatures for `fridge`, `lighting`, and general household appliance noise (`other`).
2. **IAWE (Indian Dataset for Ambient Water and Energy)**:
   - High-resolution smart meter dataset recorded in a residential household in Delhi, India.
   - Contains high-draw compressor air conditioning channels (`air_conditioner_1` and `air_conditioner_2`).
3. **REDD (Reference Energy Disaggregation Data Set)**:
   - Benchmark US residential dataset referenced for exploratory cross-validation and architectural baseline comparisons.

---

## 2. Appliance Taxonomy & Unified Schema

### 2.1 Unified Data Schema
All disparate raw dataset formats were parsed, normalized, and unified into a standard tabular time-series structure sampled at uniform 1-minute intervals:

| Column | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | ISO 8601 UTC string / datetime | Timestamp of the power measurement. |
| `house_id` | string | Unique dwelling identifier (e.g. `UKDALE_house_1`, `IAWE_house_1`). |
| `mains_power` | float | Aggregated whole-house active power in Watts (W). |
| `fridge` | float | Sub-metered Refrigerator power in Watts (W). |
| `lighting` | float | Sub-metered Lighting power in Watts (W). |
| `ac_hvac` | float | Sub-metered Air Conditioning / HVAC power in Watts (W). |
| `other` | float | Sub-metered miscellaneous appliance power in Watts (W). |

### 2.2 Category Taxonomy Mapping
Raw sensor channels across differing research datasets use variable naming conventions. The ingestion pipeline normalizes these via `RAW_CATEGORY_MAP` ([data/config.py](file:///a:/S3/data/config.py#L45-L60)):

```python
RAW_CATEGORY_MAP = {
    "fridge": "fridge",
    "refrigerator": "fridge",
    "freezer": "fridge",
    "lighting": "lighting",
    "lights": "lighting",
    "other": "other",
    "ac": "ac_hvac",
    "hvac": "ac_hvac",
    "ac_hvac": "ac_hvac",
    "air_conditioner": "ac_hvac",
    "air_conditioner_1": "ac_hvac",
    "air_conditioner_2": "ac_hvac",
    "water": "water_heater",
    "water_heater": "water_heater",
}
```

### 2.3 Binary State Binarization & 10.0W Ground-Truth Activation Threshold
For supervised binary classification, continuous appliance power values (Watts) are binarized into operational ON/OFF ground-truth targets using a uniform baseline threshold:
$$y_{c, t} = \mathbb{I}(\text{power}_{c, t} \ge 10.0\text{ W})$$
Any sub-metered power reading exceeding 10.0 Watts is labeled as active state (1), while standby or quiescent draw below 10.0 Watts is labeled as inactive (0).

**Why a Uniform 10.0W Threshold Does Not Introduce Labeling Noise Across Different Power Scales:**
1. **Sub-Meter Channel Isolation (Not Aggregate Mains)**: The 10.0W threshold is applied directly to **individual sub-metered appliance channels**, never to the whole-house mains signal.
   - **Air Conditioner Sub-Meter**: When inactive, standby electronics draw $0\text{W} - 5\text{W}$. When active, compressor draw jumps to $1200\text{W} - 1800\text{W}$. The 10.0W threshold sits cleanly in the large gap between 5W idle and 1200W operation.
   - **Refrigerator Sub-Meter**: When the compressor is off, quiescent control draw is $1\text{W} - 5\text{W}$. When the compressor cycles on, draw rises to $80\text{W} - 120\text{W}$. The 10.0W threshold cleanly isolates active cooling cycles.
   - **Lighting Sub-Meter**: When lights are switched off, sub-meter draw is $0\text{W}$. When a single fixture or LED bulb is switched on, draw is $15\text{W} - 150\text{W}$, immediately clearing the 10.0W floor.
2. **Standby Noise Gate**: Across all sub-metered circuits in UK-DALE and IAWE, background quantization noise, current transformer drift, and phantom standby power hover strictly below 5.0W. Thus, 10.0W functions as a universal *standby noise gate*.
3. **Decoupled Classification vs. Power Integration**: The binary models only predict the discrete active state ($y_c \in \{0, 1\}$). Actual physical power scale assignment and consumption integration during inference are handled distinctly per category in [model/predict.py](file:///a:/S3/model/predict.py):
   - `fridge`: $100.0\text{W}$ nominal active draw
   - `lighting`: $15.0\text{W}$ nominal active draw
   - `ac_hvac`: $1600.0\text{W}$ nominal compressor draw
   - `other`: residual dynamic allocation ($P_{\text{mains}} - \sum P_{\text{known}}$)
4. **Per-Category Decision Thresholds**: While the ground-truth binarization threshold on sub-meters is 10.0W, the **probabilistic classification thresholds** applied during inference are tuned per category (`lighting: 0.15`, `fridge: 0.40`, `ac_hvac: 0.40`, `other: 0.35`).

---

## 3. Feature Engineering Pipeline

Feature extraction is shared identically between model training and real-time backend inference via [model/features.py](file:///a:/S3/model/features.py). The pipeline extracts 8 engineered features from raw 1-minute mains power time series:

| Feature Name | Category | Formula / Extraction Description | Rationale |
| :--- | :--- | :--- | :--- |
| `power_w` | Instantaneous | $P_t$ (raw mains power in Watts) | Captures base aggregate power magnitude. |
| `power_delta` | Differential | $\Delta P_t = P_t - P_{t-1}$ | Identifies sharp transient on/off switching events. |
| `rolling_mean_5m` | Statistical | $\mu_{5}(t) = \frac{1}{5} \sum_{i=0}^4 P_{t-i}$ | Smoothes short-term noise and measures sustained load level. |
| `rolling_std_5m` | Statistical | $\sigma_{5}(t) = \sqrt{\frac{1}{5} \sum (P - \mu_5)^2}$ | Detects dynamic variability within immediate operation window. |
| `rolling_mean_15m` | Statistical | $\mu_{15}(t) = \frac{1}{15} \sum_{i=0}^{14} P_{t-i}$ | Quantifies medium-term sustained baseline consumption. |
| `rolling_std_15m` | Statistical | $\sigma_{15}(t) = \sqrt{\frac{1}{15} \sum (P - \mu_{15})^2}$ | Distinguishes cyclical duty cycles from steady resistive loads. |
| `hour_of_day` | Temporal | $\text{hour}(t) \in [0, 23]$ | Incorporates diurnal behavioral priors (e.g. evening lighting). |
| `day_of_week` | Temporal | $\text{weekday}(t) \in [0, 6]$ | Encodes weekly occupancy variations (weekday vs. weekend). |

---

## 4. House-Based Train/Test Validation Methodology

To prevent data leakage across contiguous temporal rows, evaluation partitions data using `GroupKFold` grouped strictly by `house_id`:
- **House Clusters**: 6 physical houses partitioned into 7 evaluation clusters:
  - `UKDALE_house_1`, `UKDALE_house_2`, `UKDALE_house_3`, `UKDALE_house_4`, `UKDALE_house_5`
  - `IAWE_house_1`, `IAWE_house_2`
- **Zero Leakage Rule**: No temporal windows from a test house are present in the training folds for that split.

---

## 5. Critical Dataset Limitations & Honest Disclosure

1. **AC/HVAC Signal Isolation**:
   - In the benchmark data combination, all 310 positive AC/HVAC training samples originate exclusively from IAWE channels recorded in a single physical household.
   - All 5 UK-DALE households contain 0 positive AC samples (UK domestic climate typically lacks residential air conditioning).
   - To enable GroupKFold validation without collapsing the AC class, IAWE sub-channels were split into `IAWE_house_1` and `IAWE_house_2`.
2. **Untrained `water_heater` Category**:
   - The combined public datasets contain zero verified electric water heater ground truth channels.
   - The category is explicitly bypassed during training and declared `not_yet_trained: true` with `model_score: 0.0`.
3. **Domain Transfer Gap**:
   - Benchmark models reflect European and Indian housing electrical profiles. Transfer calibration to Egyptian residential housing stock (220V/50Hz grid with ubiquitous split-unit AC and electric water heaters) is the primary focus of the Phase 1 field pilot.
