package com.enzyme.optimizer.model;

import java.util.ArrayList;
import java.util.List;

import com.enzyme.optimizer.data.DatasetAnalyzer;
import com.enzyme.optimizer.data.ExperimentalDesignDetector;

public class ModelStrategy {

    public static StrategyResult determine(
            DatasetAnalyzer.AnalysisResult analysis,
            ExperimentalDesignDetector.DesignResult design) {

        List<String> recommendedModels = new ArrayList<>();


        if (analysis.hasOnlyNumericParameters()) {

            recommendedModels.add("Linear Regression");
            recommendedModels.add("Decision Tree");
            recommendedModels.add("Random Forest");
            recommendedModels.add("Support Vector Regression");
            recommendedModels.add("Additive Regression");
            recommendedModels.add(ModelTrainer.ANN_NAME);

            if (design.isRsmApplicable()) {
                recommendedModels.add("RSM Quadratic Regression");
            }
        }



        else {

            recommendedModels.add("Decision Tree");
            recommendedModels.add("Random Forest");
            recommendedModels.add("Additive Regression");
            recommendedModels.add(ModelTrainer.ANN_NAME);

            recommendedModels.add(
                    "Categorical parameters handled automatically");

            if (analysis.getNumericParameters().size() > 0) {
                recommendedModels.add(
                        "Numeric + categorical mixed-parameter modeling");
            }
        }


        String reason;

        if (analysis.hasOnlyNumericParameters()
                && design.isRsmApplicable()) {

            reason =
                    "Continuous numeric process parameters and an "
                  + "experimental design suitable for quadratic response-"
                  + "surface modeling were detected. General ML models "
                  + "and quadratic RSM will be evaluated.";

        } else if (analysis.hasOnlyNumericParameters()) {

            reason =
                    "Numeric process parameters were detected. General "
                  + "ML models will be evaluated. The detected experimental "
                  + "design does not currently justify the available "
                  + "quadratic RSM implementation.";

        } else {

            reason =
                    "The dataset contains categorical process parameters. "
                  + "Categorical values are retained and encoded automatically "
                  + "for compatible machine-learning models. Tree-based "
                  + "models are included because they can handle the resulting "
                  + "mixed numeric/categorical representation.";
        }

        return new StrategyResult(
                recommendedModels,
                reason);
    }


    public static class StrategyResult {

        private final List<String> recommendedModels;
        private final String reason;

        public StrategyResult(
                List<String> recommendedModels,
                String reason) {

            this.recommendedModels =
                    recommendedModels;

            this.reason = reason;
        }

        public List<String> getRecommendedModels() {
            return recommendedModels;
        }

        public String getReason() {
            return reason;
        }
    }
}