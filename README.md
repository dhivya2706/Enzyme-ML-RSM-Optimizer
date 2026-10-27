# Enzyme Optimizer

**Live Website:** [EnzymeML Optimization Studio](https://enzyme-ml-rsm-optimizer.vercel.app)

A web application for predicting and optimizing enzyme activity from process parameters. It trains and compares several machine-learning models and a classical Response Surface Methodology (RSM) model on an uploaded dataset, then searches for the parameter combination that gives the highest predicted activity.

## Features

- Upload experimental data as **CSV, XLS or XLSX**.
- Automatic data cleaning and detection of numeric and categorical process parameters.
- Automatic detection of **Central Composite Design (CCD)** to decide whether RSM is applicable.
- Seven models compared with the same **5-fold cross-validation**: Linear Regression, Decision Tree, Random Forest, Support Vector Regression, Additive Regression, Neural Network (ANN) and RSM Quadratic.
- Automatic tuning of the neural network (24-configuration grid).
- Reporting of **R², RMSE and MAE** for every model.
- Search for optimum process conditions (ML models and RSM).
- Prediction for new factor settings, with a warning when inputs are outside the experimental range.

## Technology stack

| Part | Technology |
|---|---|
| Backend | Java 17, Spring Boot 3.4.2, Maven |
| Machine learning | Weka 3.8.6 (`weka-stable`), custom RSM implementation |
| Spreadsheet reading | Apache POI 5.4.0 (XLS/XLSX), custom CSV parser |
| Frontend | React 18.3, Vite 6, Axios, SheetJS (`xlsx`), lucide-react |

## Project structure

```text
GenericEnzymeOptimizer2_with_ANN/
├── GenericEnzymeOptimizer2/
│   ├── src/main/java/com/enzyme/optimizer/
│   │   ├── api/              REST controllers
│   │   ├── config/           CORS configuration
│   │   ├── data/             File reading, preprocessing, design detection, in-memory stores
│   │   ├── model/            Model training, strategy, results, RSM model
│   │   ├── optimization/     Parameter optimization
│   │   └── util/             Statistical utilities
│   ├── pom.xml
│   ├── Dockerfile
│   └── enzyme-dashboard/
│       ├── package.json
│       └── src/
└── README.md
```

## Getting started

### Requirements

- Java 17 or later
- Maven 3.6 or later
- Node.js 18 or later and npm

### 1. Run the backend

Open a terminal in the backend directory:

```bash
cd GenericEnzymeOptimizer2
mvn spring-boot:run
```

The API runs locally on `http://localhost:8080` by default. Check its status with:

```bash
curl http://localhost:8080/api/health
```

### 2. Run the frontend

Open a second terminal in the frontend directory:

```bash
cd GenericEnzymeOptimizer2/enzyme-dashboard
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

For local development, the frontend defaults to `http://localhost:8080/api`. If you change the backend URL or frontend origin, update the environment configuration and CORS settings accordingly.

To build the frontend for production:

```bash
npm run build
```

### 3. Use the deployed website

You can also use the application online without installing the development tools:

**[Open EnzymeML Optimization Studio](https://enzyme-ml-rsm-optimizer.vercel.app)**

Upload an experimental dataset, select the target response column, and run the available ML/RSM analysis.

## Input data format

- One row per experimental run, with a header row. Only the **first sheet** of an Excel file is read.
- CSV files may use comma, semicolon or tab delimiters (UTF-8).
- The **target column** must be numeric. The default name is `ObservedActivity_U_ml`; another column can be selected.
- All other columns are treated as process parameters (numeric or categorical), except columns that are automatically excluded:
  - Names ending in `_coded`
  - Names containing `predicted` or `prediction`
  - Identifier-like names (`id`, `run`, `std`, `index`, `no`, `number`, `experiment`, `trial`, `sample`, `sampleid`)
- Rows with empty or invalid values in any retained column are removed. Duplicates are kept because replicates and center points are needed for RSM.

Example:

| Temperature | pH | Substrate_g_L | ObservedActivity_U_ml |
|---|---|---|---|
| 30 | 5.0 | 10 | 1.82 |
| 37 | 6.0 | 15 | 2.45 |

## API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service status and default target column |
| POST | `/api/datasets/upload` | Upload a dataset (multipart field `file`) |
| POST | `/api/optimization/run` | Train applicable models and return metrics and optimum conditions. Optional JSON body: `{ "targetColumn": "..." }` |
| GET | `/api/predictions/info` | List factors (ranges or categories) and trained models |
| POST | `/api/predictions` | Predict activity for new settings |

Prediction request example:

```json
{
  "model": "Neural Network (ANN)",
  "inputs": {
    "Temperature": 40,
    "pH": 7
  }
}
```

Use `"points": [ {...}, {...} ]` for multiple points (maximum 5000 per request). Omit `model` to request predictions from all models.

## Methods summary

| Model | Weka class / implementation | Settings |
|---|---|---|
| Linear Regression | `LinearRegression` | Defaults (numeric-only data) |
| Decision Tree | `REPTree` | Defaults |
| Random Forest | `RandomForest` | 150 trees, seed 42 |
| Support Vector Regression | `SMOreg` | Defaults (numeric-only data) |
| Additive Regression | `AdditiveRegression` | Defaults |
| Neural Network (ANN) | `MultilayerPerceptron` | Hidden layers `{3; 5; 8; 4,3}`, learning rate `{0.1, 0.3}`, epochs at 15/40/100% of base, momentum 0.2, seed 42 |
| RSM Quadratic | Custom `RSMQuadraticModel` | Full second-order model; exactly 3 numeric factors; CCD detected |

- **Validation:** 5-fold cross-validation, random seed 42. R² is calculated from pooled out-of-fold predictions. Final models are refitted on all rows.
- **Best ML model:** Highest R², with lower RMSE as tie-breaker; RSM is excluded from this selection.
- **Optimization:** 5000-point random search within the observed parameter ranges for ML models; analytical stationary point or bounded search for RSM.

## Known limitations

- Models are trained separately for each uploaded dataset; there is no combined multi-enzyme model.
- Cross-validation folds are random by row, not grouped by source paper, and there is no independent hold-out test set.
- Only the ANN is tuned; other models use default settings.
- RSM requires exactly three numeric factors and a detected CCD design.
- Datasets from designed experiments are small, so cross-validated R² can be unstable.
- The backend keeps data and models in memory for a single user; a new upload replaces the previous one. Avoid assuming that different users' datasets are stored permanently.

## Data availability

Add the enzyme dataset names, original sources, and any relevant references here. If the datasets are included in the repository, document their file locations and attribution.
