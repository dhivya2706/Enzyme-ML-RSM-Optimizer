package com.enzyme.optimizer.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import weka.classifiers.Classifier;

public class ModelResult {

    private final String modelName;

    private final Classifier model;

    private final double r2;

    private final double rmse;

    private final double mae;

  
    private final Map<String, Object> details;

    public ModelResult(
            String modelName,
            Classifier model,
            double r2,
            double rmse,
            double mae) {

        this(modelName, model, r2, rmse, mae, null);
    }

    public ModelResult(
            String modelName,
            Classifier model,
            double r2,
            double rmse,
            double mae,
            Map<String, Object> details) {

        this.modelName = modelName;
        this.model = model;
        this.r2 = r2;
        this.rmse = rmse;
        this.mae = mae;
        this.details = details == null
                ? Collections.emptyMap()
                : Collections.unmodifiableMap(
                        new LinkedHashMap<>(details));
    }

    public String getModelName() {
        return modelName;
    }

    public Classifier getModel() {
        return model;
    }

    public double getR2() {
        return r2;
    }

    public double getRmse() {
        return rmse;
    }

    public double getMae() {
        return mae;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
