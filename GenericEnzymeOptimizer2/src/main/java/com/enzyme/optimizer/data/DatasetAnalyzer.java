package com.enzyme.optimizer.data;

import java.util.ArrayList;
import java.util.List;

import weka.core.Attribute;
import weka.core.Instances;

public class DatasetAnalyzer {

    public static AnalysisResult analyze(Instances dataset) {

        if (dataset == null || dataset.numInstances() == 0) {
            throw new IllegalArgumentException("Dataset is empty.");
        }

        List<String> numericParameters = new ArrayList<>();
        List<String> categoricalParameters = new ArrayList<>();

        int targetIndex = dataset.classIndex();

        for (int i = 0; i < dataset.numAttributes(); i++) {

            if (i == targetIndex) {
                continue;
            }

            Attribute attribute = dataset.attribute(i);

            if (attribute.isNumeric()) {
                numericParameters.add(attribute.name());

            } else if (attribute.isNominal()) {
                categoricalParameters.add(attribute.name());
            }
        }

        return new AnalysisResult(
                dataset.numInstances(),
                numericParameters.size()
                        + categoricalParameters.size(),
                dataset.classAttribute().name(),
                numericParameters,
                categoricalParameters
        );
    }

    public static class AnalysisResult {

        private final int rows;
        private final int parameterCount;
        private final String targetColumn;

        private final List<String> numericParameters;
        private final List<String> categoricalParameters;

        public AnalysisResult(
                int rows,
                int parameterCount,
                String targetColumn,
                List<String> numericParameters,
                List<String> categoricalParameters) {

            this.rows = rows;
            this.parameterCount = parameterCount;
            this.targetColumn = targetColumn;
            this.numericParameters = numericParameters;
            this.categoricalParameters = categoricalParameters;
        }

        public int getRows() {
            return rows;
        }

        public int getParameterCount() {
            return parameterCount;
        }

        public String getTargetColumn() {
            return targetColumn;
        }

        public List<String> getNumericParameters() {
            return numericParameters;
        }

        public List<String> getCategoricalParameters() {
            return categoricalParameters;
        }

        public boolean hasCategoricalParameters() {
            return !categoricalParameters.isEmpty();
        }

        public boolean hasOnlyNumericParameters() {
            return categoricalParameters.isEmpty();
        }

        public boolean hasThreeNumericParameters() {
            return numericParameters.size() == 3
                    && categoricalParameters.isEmpty();
        }
    }
}