package com.enzyme.optimizer.optimization;

import java.util.Arrays;
import java.util.Random;

import com.enzyme.optimizer.model.RSMQuadraticModel;

import weka.classifiers.Classifier;
import weka.core.Attribute;
import weka.core.DenseInstance;
import weka.core.Instances;
import weka.core.Utils;

public class ParameterOptimizer {

    public static class OptimizationResult {

        public double[] parameters;

        public double predictedGrowth;

        public OptimizationResult(
                double[] parameters,
                double predictedGrowth) {

            this.parameters =
                    parameters;

            this.predictedGrowth =
                    predictedGrowth;
        }
    }



    public static OptimizationResult optimize(
            Classifier model,
            Instances dataset,
            int iterations)
            throws Exception {

        if (model == null) {

            throw new IllegalArgumentException(
                    "Model cannot be null."
            );
        }

        if (dataset == null ||
                dataset.numInstances() == 0) {

            throw new IllegalArgumentException(
                    "Dataset is empty."
            );
        }

        if (model instanceof RSMQuadraticModel) {

            return optimizeRSM(
                    (RSMQuadraticModel) model,
                    dataset
            );
        }

        return optimizeMachineLearningModel(
                model,
                dataset,
                iterations
        );
    }


    private static OptimizationResult optimizeRSM(
            RSMQuadraticModel model,
            Instances dataset)
            throws Exception {

        double[] codedPoint =
                model.getStationaryPointCoded();

        double alpha =
                model.getAlpha();

        if (!model.isStationaryPointWithinCCD()) {

           
            return boundedRSMSearch(
                    model,
                    dataset,
                    alpha
            );
        }

        double[] actualPoint =
                model.getStationaryPointActual();

        double[] values =
                new double[
                        dataset.numAttributes()
                ];

        Arrays.fill(
                values,
                Utils.missingValue()
        );

 
        for (int factor = 0;
             factor < 3;
             factor++) {

            values[factor] =
                    actualPoint[factor];
        }

        DenseInstance instance =
                new DenseInstance(
                        1.0,
                        values
                );

        instance.setDataset(dataset);

        double prediction =
                model.classifyInstance(
                        instance
                );

        return new OptimizationResult(
                values,
                prediction
        );
    }


    private static OptimizationResult boundedRSMSearch(
            RSMQuadraticModel model,
            Instances dataset,
            double alpha)
            throws Exception {

        Random random =
                new Random(42);

        double bestPrediction =
                Double.NEGATIVE_INFINITY;

        double[] bestParameters =
                null;

        int classIndex =
                dataset.classIndex();

        int iterations =
                20000;

        for (int iteration = 0;
             iteration < iterations;
             iteration++) {

            double x1 =
                    -alpha +
                            random.nextDouble()
                                    * 2.0 *
                                    alpha;

            double x2 =
                    -alpha +
                            random.nextDouble()
                                    * 2.0 *
                                    alpha;

            double x3 =
                    -alpha +
                            random.nextDouble()
                                    * 2.0 *
                                    alpha;

   
            double radiusSquared =
                    x1 * x1 +
                    x2 * x2 +
                    x3 * x3;

            if (radiusSquared >
                    alpha * alpha) {

                continue;
            }

            double[] actual = {

                    model.toActual(x1, 0),
                    model.toActual(x2, 1),
                    model.toActual(x3, 2)
            };

            double[] values =
                    new double[
                            dataset.numAttributes()
                    ];

            Arrays.fill(
                    values,
                    Utils.missingValue()
            );

            for (int factor = 0;
                 factor < 3;
                 factor++) {

                values[factor] =
                        actual[factor];
            }

            DenseInstance instance =
                    new DenseInstance(
                            1.0,
                            values
                    );

            instance.setDataset(dataset);

            double prediction =
                    model.classifyInstance(
                            instance
                    );

            if (Double.isNaN(prediction) ||
                    Double.isInfinite(prediction)) {

                continue;
            }

            if (prediction >
                    bestPrediction) {

                bestPrediction =
                        prediction;

                bestParameters =
                        values.clone();
            }
        }

        if (bestParameters == null) {

            throw new IllegalStateException(
                    "RSM boundary optimization failed."
            );
        }

  
        bestParameters[classIndex] =
                Utils.missingValue();

        return new OptimizationResult(
                bestParameters,
                bestPrediction
        );
    }


    private static OptimizationResult
    optimizeMachineLearningModel(
            Classifier model,
            Instances dataset,
            int iterations)
            throws Exception {

        if (iterations <= 0) {
            iterations = 5000;
        }

        Random random =
                new Random(42);

        double bestPrediction =
                Double.NEGATIVE_INFINITY;

        double[] bestParameters =
                null;

        int classIndex =
                dataset.classIndex();

        if (classIndex < 0) {

            throw new IllegalArgumentException(
                    "Target/class column is not set."
            );
        }


        double[] minValues =
                new double[
                        dataset.numAttributes()
                ];

        double[] maxValues =
                new double[
                        dataset.numAttributes()
                ];

        Arrays.fill(
                minValues,
                Double.POSITIVE_INFINITY
        );

        Arrays.fill(
                maxValues,
                Double.NEGATIVE_INFINITY
        );

        for (int i = 0;
             i < dataset.numAttributes();
             i++) {

            if (i == classIndex) {
                continue;
            }

            Attribute attribute =
                    dataset.attribute(i);

            if (!attribute.isNumeric()) {
                continue;
            }

            for (int row = 0;
                 row < dataset.numInstances();
                 row++) {

                double value =
                        dataset.instance(row)
                                .value(i);

                if (Double.isNaN(value)) {
                    continue;
                }

                if (value < minValues[i]) {
                    minValues[i] = value;
                }

                if (value > maxValues[i]) {
                    maxValues[i] = value;
                }
            }

            if (minValues[i] ==
                    Double.POSITIVE_INFINITY) {

                throw new IllegalArgumentException(
                        "No valid numeric values for parameter: " +
                                attribute.name()
                );
            }
        }

        for (int iteration = 0;
             iteration < iterations;
             iteration++) {

            double[] values =
                    new double[
                            dataset.numAttributes()
                    ];

            Arrays.fill(
                    values,
                    Utils.missingValue()
            );

            for (int i = 0;
                 i < dataset.numAttributes();
                 i++) {

                Attribute attribute =
                        dataset.attribute(i);


                if (i == classIndex) {

                    values[i] =
                            Utils.missingValue();

                    continue;
                }


                if (attribute.isNumeric()) {

                    double min =
                            minValues[i];

                    double max =
                            maxValues[i];

                    if (min == max) {

                        values[i] =
                                min;

                    } else {

                        values[i] =
                                min +
                                random.nextDouble()
                                        * (max - min);
                    }
                }

                else if (attribute.isNominal()) {

                    int count =
                            attribute.numValues();

                    if (count > 0) {

                        values[i] =
                                random.nextInt(
                                        count
                                );
                    }
                }
            }

            DenseInstance instance =
                    new DenseInstance(
                            1.0,
                            values
                    );

            instance.setDataset(dataset);

            double prediction =
                    model.classifyInstance(
                            instance
                    );

            if (Double.isNaN(prediction) ||
                    Double.isInfinite(prediction)) {

                continue;
            }

            if (prediction >
                    bestPrediction) {

                bestPrediction =
                        prediction;

                bestParameters =
                        values.clone();
            }
        }

        if (bestParameters == null) {

            throw new IllegalStateException(
                    "Optimization failed. " +
                            "No valid prediction was generated."
            );
        }

        return new OptimizationResult(
                bestParameters,
                bestPrediction
        );
    }
}