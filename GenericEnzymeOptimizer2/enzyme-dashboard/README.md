# EnzymeML Optimization Studio — React dashboard

Professional dashboard for the Spring Boot **GenericEnzymeOptimizer2** backend.
The backend now also trains a **neural network (ANN)** and exposes `/api/predictions`.
Endpoints used: `/api/health`, `/api/datasets/upload`, `/api/optimization/run`,
`/api/predictions` (POST) and `/api/predictions/info` (GET).

## Run

```bash
npm install        # once (adds the `xlsx` package used to read .xlsx in the browser)
npm run dev        # http://localhost:5173
```

Start the backend first (`java -jar target/cellulase-optimization-1.0.0.jar`, port 8080).
To point at another API, copy `.env.example` to `.env` and edit `VITE_API_BASE_URL`.

## Pages

| Page | What it shows |
|------|---------------|
| **Overview** | Best overall model, KPIs, RSM-vs-best-ML head-to-head, leaderboard, ML optimum |
| **Data Workspace** | Upload (drag & drop), target column, detected factors, data preview |
| **RSM vs ML Plots** | Actual-vs-predicted, residuals, run-by-run comparison |
| **Response Surfaces** | Design-Expert-style 3D surfaces + contour maps, RSM and ML side by side, difference map, all factor pairs (a, b, c), PNG export, drag to rotate |
| **Live Predictor** | Sliders for every factor, RSM vs ML vs **ANN** prediction, all optima, one-factor response curves |

Extras: collapsible sidebar, mobile drawer, right-hand controls inspector, light/dark theme (remembered).

## How the charts are produced

The backend returns metrics and the ML optimum only, not per-point predictions.
So the browser reads the same uploaded file and rebuilds the models to draw charts:

* **RSM** — quadratic least-squares fit in coded variables (same model form as `RSMQuadraticModel`).
* **ML** — a re-implementation of whichever model the backend selected as best
  (Random Forest, Decision Tree, Linear, SVR, Additive Regression). It approximates the Weka model.

The cross-validated R² / RMSE / MAE shown on the Overview page come straight from the backend
and are the authoritative scores. Fit statistics on the plot pages are training-fit values computed in the browser.

Note: `.xls` (old Excel) uploads work for the backend, but charts need `.xlsx` or `.csv`.

## Neural network (ANN)

The backend trains a Weka `MultilayerPerceptron` alongside the other models. Network shape,
learning rate and number of epochs are chosen by cross-validation (small designs over-fit
easily, so training length is tuned too). Results appear in the leaderboard, on the Overview
page (ANN card) and on the Live Predictor.

* **Predictor values come from the backend** (`POST /api/predictions`), i.e. the actual trained
  Weka network. Example: `{"model":"ann","inputs":{"pH":7,"Temp":40}}` or `{"points":[{...},{...}]}`.
  Responses flag factors outside the experimental range (`extrapolation`, `outOfRange`).
* A small browser MLP is used only to draw surfaces when the ANN is the best ML model. It is an
  approximation of the Weka network, not identical.
* With few runs an ANN can over-fit. Judge it by cross-validated R² / RMSE.
