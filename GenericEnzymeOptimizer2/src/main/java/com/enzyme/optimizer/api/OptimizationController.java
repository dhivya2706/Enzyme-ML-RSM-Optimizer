
package com.enzyme.optimizer.api;

import com.enzyme.optimizer.data.DatasetProcessor;
import com.enzyme.optimizer.data.ExperimentalDesignDetector;
import com.enzyme.optimizer.data.UploadedDatasetStore;
import com.enzyme.optimizer.data.TrainedModelStore;
import com.enzyme.optimizer.data.DatasetAnalyzer;
import com.enzyme.optimizer.model.ModelResult;
import com.enzyme.optimizer.model.ModelTrainer;
import com.enzyme.optimizer.optimization.ParameterOptimizer;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import weka.core.Instances;

import java.util.*;

@RestController
@RequestMapping("/api/optimization")
@CrossOrigin(origins = "http://localhost:5173")
public class OptimizationController {

    private final UploadedDatasetStore store;
    private final TrainedModelStore trainedModels;

    public OptimizationController(
            UploadedDatasetStore store,
            TrainedModelStore trainedModels) {
        this.store = store;
        this.trainedModels = trainedModels;
    }

    private static Map<String, Object> describe(ModelResult result) {
        Map<String, Object> model = new LinkedHashMap<>();

        model.put("modelName", result.getModelName());
        model.put("r2", result.getR2());
        model.put("rmse", result.getRmse());
        model.put("mae", result.getMae());

        if (!result.getDetails().isEmpty()) {
            model.put("details", result.getDetails());
        }

        return model;
    }

    @PostMapping("/run")
    public Map<String, Object> runOptimization(
            @RequestBody(required = false)
            Map<String, Object> request) {

        if (!store.hasDataset()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Upload a dataset before running optimization."
            );
        }

        try {
            String targetColumn = "ObservedActivity_U_ml";

            if (request != null
                    && request.get("targetColumn") != null) {
                targetColumn =
                    request.get("targetColumn").toString();
            }

            Instances dataset = DatasetProcessor.convertToWeka(
                store.getRows(), targetColumn
            );

            ExperimentalDesignDetector.DesignResult design =
                ExperimentalDesignDetector.detect(dataset);

            List<ModelResult> results =
                ModelTrainer.trainModels(dataset, design);

            if (results == null || results.isEmpty()) {
                throw new IllegalStateException(
                    "No models were successfully trained."
                );
            }

            trainedModels.save(dataset, targetColumn, results);

            ModelResult bestML =
                ModelTrainer.selectBestMLModel(results);

            ModelResult ann =
                ModelTrainer.getANNResult(results);

            ModelResult rsm =
                ModelTrainer.getRSMResult(results);

            Map<String, Object> response =
                new LinkedHashMap<>();

            response.put("status", "success");
            response.put("targetColumn", targetColumn);
            response.put("rowCount", dataset.numInstances());
            response.put("design", design.getDesignName());

            List<Map<String, Object>> modelResults =
                new ArrayList<>();

            for (ModelResult result : results) {
                modelResults.add(describe(result));
            }

            response.put("models", modelResults);

            if (bestML != null) {
                response.put("bestMLModel", describe(bestML));

                ParameterOptimizer.OptimizationResult optimum =
                    ParameterOptimizer.optimize(
                        bestML.getModel(), dataset, 5000
                    );

                response.put("mlOptimum", Map.of(
                    "parameters", optimum.parameters,
                    "predictedActivity", optimum.predictedGrowth
                ));
            }

            if (ann != null) {
                response.put("annModel", describe(ann));

                try {
                    ParameterOptimizer.OptimizationResult annOptimum =
                        ParameterOptimizer.optimize(
                            ann.getModel(), dataset, 5000
                        );

                    response.put("annOptimum", Map.of(
                        "parameters", annOptimum.parameters,
                        "predictedActivity", annOptimum.predictedGrowth
                    ));
                } catch (Exception e) {
                    System.err.println(
                        "ANN optimum search failed: " + e.getMessage());
                }
            }

            if (rsm != null) {
                response.put("rsmModel", Map.of(
                    "modelName", rsm.getModelName(),
                    "r2", rsm.getR2(),
                    "rmse", rsm.getRmse(),
                    "mae", rsm.getMae()
                ));
            }

            return response;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Optimization failed: " + e.getMessage(),
                e
            );
        }
    }
}
