package com.enzyme.optimizer.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import com.enzyme.optimizer.data.DatasetAnalyzer;
import com.enzyme.optimizer.data.ExperimentalDesignDetector;

import weka.classifiers.Classifier;
import weka.classifiers.Evaluation;
import weka.classifiers.evaluation.Prediction;
import weka.classifiers.functions.LinearRegression;
import weka.classifiers.functions.MultilayerPerceptron;
import weka.classifiers.functions.SMOreg;
import weka.classifiers.meta.AdditiveRegression;
import weka.classifiers.trees.REPTree;
import weka.classifiers.trees.RandomForest;
import weka.core.Instances;


public class ModelTrainer {

    public static final String ANN_NAME = "Neural Network (ANN)";


    public static List<ModelResult> trainModels(
            Instances dataset,
            ExperimentalDesignDetector.DesignResult design,
            ModelStrategy.StrategyResult strategy)
            throws Exception {

        if (dataset == null ||
                dataset.numInstances() < 2) {

            throw new IllegalArgumentException(
                    "At least 2 valid data rows are required.");
        }

        if (strategy == null) {
            throw new IllegalArgumentException(
                    "Model strategy is required.");
        }

        List<ModelResult> results =
                new ArrayList<>();

        int folds =
                Math.min(
                        5,
                        dataset.numInstances());

        if (folds < 2) {
            folds = 2;
        }

        List<String> recommendedModels =
                strategy.getRecommendedModels();



        if (recommendedModels.contains("Linear Regression")) {

            try {

                LinearRegression model =
                        new LinearRegression();

                results.add(
                        evaluateModel(
                                "Linear Regression",
                                model,
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "Linear Regression failed: "
                        + e.getMessage());
            }
        }

 

        if (recommendedModels.contains("Decision Tree")) {

            try {

                REPTree model =
                        new REPTree();

                results.add(
                        evaluateModel(
                                "Decision Tree",
                                model,
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "Decision Tree failed: "
                        + e.getMessage());
            }
        }

        // =====================================================
        // RANDOM FOREST
        // =====================================================

        if (recommendedModels.contains("Random Forest")) {

            try {

                RandomForest model =
                        new RandomForest();

                model.setNumIterations(150);
                model.setSeed(42);

                results.add(
                        evaluateModel(
                                "Random Forest",
                                model,
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "Random Forest failed: "
                        + e.getMessage());
            }
        }



        if (recommendedModels.contains(
                "Support Vector Regression")) {

            try {

                SMOreg model =
                        new SMOreg();

                results.add(
                        evaluateModel(
                                "Support Vector Regression",
                                model,
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "Support Vector Regression failed: "
                        + e.getMessage());
            }
        }



        if (recommendedModels.contains(
                "Additive Regression")) {

            try {

                AdditiveRegression model =
                        new AdditiveRegression();

                results.add(
                        evaluateModel(
                                "Additive Regression",
                                model,
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "Additive Regression failed: "
                        + e.getMessage());
            }
        }

 

        if (recommendedModels.contains(ANN_NAME)) {

            try {

                results.add(
                        trainANN(
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "Neural Network (ANN) failed: "
                        + e.getMessage());
            }
        }


        if (design != null &&
                design.isRsmApplicable()) {

            try {

                RSMQuadraticModel model =
                        new RSMQuadraticModel();

                results.add(
                        evaluateModel(
                                "RSM Quadratic Regression",
                                model,
                                dataset,
                                folds));
            }

            catch (Exception e) {

                System.err.println(
                        "RSM Quadratic Regression failed: "
                        + e.getMessage());
            }

        } else {

            System.out.println(
                    "RSM Quadratic Regression skipped: "
                    + "detected experimental design is not "
                    + "currently suitable for the available "
                    + "RSM implementation.");
        }



        if (results.isEmpty()) {

            throw new IllegalStateException(
                    "All recommended models failed.");
        }

        return results;
    }



    public static List<ModelResult> trainModels(
            Instances dataset,
            ExperimentalDesignDetector.DesignResult design)
            throws Exception {

        DatasetAnalyzer.AnalysisResult analysis =
                DatasetAnalyzer.analyze(dataset);

        ModelStrategy.StrategyResult strategy =
                ModelStrategy.determine(
                        analysis,
                        design);

        return trainModels(
                dataset,
                design,
                strategy);
    }

   

    private static final String[] ANN_HIDDEN_LAYERS =
            { "3", "5", "8", "4,3" };

    private static final double[] ANN_LEARNING_RATES =
            { 0.1, 0.3 };

    private static final double ANN_MOMENTUM = 0.2;

    private static final double[] ANN_EPOCH_FRACTIONS =
            { 0.15, 0.4, 1.0 };

    private static int annBaseEpochs(int rows) {

        if (rows <= 200) {
            return 1500;
        }

        if (rows <= 1000) {
            return 500;
        }

        return 200;
    }

    private static MultilayerPerceptron newANN(
            String hiddenLayers,
            double learningRate,
            int epochs) {

        MultilayerPerceptron ann =
                new MultilayerPerceptron();

        ann.setHiddenLayers(hiddenLayers);
        ann.setLearningRate(learningRate);
        ann.setMomentum(ANN_MOMENTUM);
        ann.setTrainingTime(epochs);
        ann.setNormalizeAttributes(true);
        ann.setNormalizeNumericClass(true);
        ann.setNominalToBinaryFilter(true);
        ann.setDecay(false);
        ann.setValidationSetSize(0);
        ann.setSeed(42);
        ann.setGUI(false);

        return ann;
    }

    private static ModelResult trainANN(
            Instances dataset,
            int folds)
            throws Exception {

        int rows = dataset.numInstances();
        int baseEpochs = annBaseEpochs(rows);

        int tuneFolds = Math.max(2, Math.min(folds, rows));

        String bestLayers = null;
        double bestRate = ANN_LEARNING_RATES[0];
        int bestEpochs = baseEpochs;
        double bestTuneRmse = Double.POSITIVE_INFINITY;


        for (String layers : ANN_HIDDEN_LAYERS) {

            for (double rate : ANN_LEARNING_RATES) {

                for (double fraction : ANN_EPOCH_FRACTIONS) {

                    int epochs = Math.max(
                            50, (int) Math.round(baseEpochs * fraction));

                    try {

                        Evaluation tuning =
                                new Evaluation(dataset);

                        tuning.crossValidateModel(
                                newANN(layers, rate, epochs),
                                dataset,
                                tuneFolds,
                                new Random(1));

                        double rmse =
                                tuning.rootMeanSquaredError();

                        if (!Double.isNaN(rmse)
                                && rmse < bestTuneRmse) {

                            bestTuneRmse = rmse;
                            bestLayers = layers;
                            bestRate = rate;
                            bestEpochs = epochs;
                        }
                    }

                    catch (Exception e) {

                        System.err.println(
                                "ANN candidate (" + layers
                                + ", lr=" + rate
                                + ", epochs=" + epochs
                                + ") skipped: " + e.getMessage());
                    }
                }
            }
        }

        if (bestLayers == null) {

            throw new IllegalStateException(
                    "No ANN configuration could be trained.");
        }

        Map<String, Object> details =
                new LinkedHashMap<>();

        details.put("hiddenLayers", bestLayers);
        details.put("learningRate", bestRate);
        details.put("momentum", ANN_MOMENTUM);
        details.put("epochs", bestEpochs);
        details.put("activation", "sigmoid (hidden), linear (output)");
        details.put("inputScaling", "[-1, 1]");

        MultilayerPerceptron ann =
                newANN(bestLayers, bestRate, bestEpochs);

        return evaluateModel(
                ANN_NAME,
                ann,
                dataset,
                folds,
                details);
    }



    private static ModelResult evaluateModel(
            String name,
            Classifier model,
            Instances dataset,
            int folds)
            throws Exception {

        return evaluateModel(
                name,
                model,
                dataset,
                folds,
                null);
    }

    private static ModelResult evaluateModel(
            String name,
            Classifier model,
            Instances dataset,
            int folds,
            Map<String, Object> details)
            throws Exception {

        Evaluation evaluation =
                new Evaluation(dataset);

        evaluation.crossValidateModel(
                model,
                dataset,
                folds,
                new Random(42));

        double rmse =
                evaluation.rootMeanSquaredError();

        double mae =
                evaluation.meanAbsoluteError();

        double r2 =
                calculateR2FromPredictions(
                        evaluation.predictions());

        model.buildClassifier(dataset);

        return new ModelResult(
                name,
                model,
                r2,
                rmse,
                mae,
                details);
    }


    private static double calculateR2FromPredictions(
            List<Prediction> predictions) {

        if (predictions == null ||
                predictions.size() < 2) {

            return 0.0;
        }

        double mean = 0.0;
        int count = 0;

        for (Prediction prediction :
                predictions) {

            double actual =
                    prediction.actual();

            if (Double.isNaN(actual)) {
                continue;
            }

            mean += actual;
            count++;
        }

        if (count < 2) {
            return 0.0;
        }

        mean /= count;

        double ssTot = 0.0;
        double ssRes = 0.0;

        for (Prediction prediction :
                predictions) {

            double actual =
                    prediction.actual();

            double predicted =
                    prediction.predicted();

            if (Double.isNaN(actual) ||
                    Double.isNaN(predicted)) {

                continue;
            }

            ssTot +=
                    Math.pow(
                            actual - mean,
                            2);

            ssRes +=
                    Math.pow(
                            actual - predicted,
                            2);
        }

        if (ssTot == 0.0) {
            return 0.0;
        }

        return 1.0 -
                (ssRes / ssTot);
    }


    public static ModelResult selectBestModel(
            List<ModelResult> results) {

        if (results == null ||
                results.isEmpty()) {

            return null;
        }

        ModelResult best =
                results.get(0);

        for (ModelResult current :
                results) {

            if (current.getR2() >
                    best.getR2()) {

                best = current;

            } else if (
                    current.getR2() ==
                            best.getR2() &&

                    current.getRmse() <
                            best.getRmse()) {

                best = current;
            }
        }

        return best;
    }

    public static ModelResult selectBestMLModel(
            List<ModelResult> results) {

        if (results == null ||
                results.isEmpty()) {

            return null;
        }

        ModelResult best = null;

        for (ModelResult current :
                results) {

            if (isRSMModel(current)) {
                continue;
            }

            if (best == null ||
                    current.getR2() > best.getR2() ||

                    (current.getR2() ==
                            best.getR2() &&

                     current.getRmse() <
                            best.getRmse())) {

                best = current;
            }
        }

        return best;
    }



    public static ModelResult getRSMResult(
            List<ModelResult> results) {

        if (results == null) {
            return null;
        }

        for (ModelResult result :
                results) {

            if (isRSMModel(result)) {
                return result;
            }
        }

        return null;
    }


    public static ModelResult getANNResult(
            List<ModelResult> results) {

        if (results == null) {
            return null;
        }

        for (ModelResult result :
                results) {

            if (result != null &&
                    ANN_NAME.equalsIgnoreCase(
                            result.getModelName())) {

                return result;
            }
        }

        return null;
    }


    private static boolean isRSMModel(
            ModelResult result) {

        return result != null &&
                "RSM Quadratic Regression"
                        .equalsIgnoreCase(
                                result.getModelName());
    }
}