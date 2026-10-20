package com.enzyme.optimizer.model;

import java.util.Arrays;

import weka.classifiers.AbstractClassifier;
import weka.core.Instance;
import weka.core.Instances;

public class RSMQuadraticModel extends AbstractClassifier {

    private static final long serialVersionUID = 1L;


    private double[] coefficients;

    private double[] centers;
    private double[] steps;

    private double alpha = 1.0;

    private boolean trained = false;


    @Override
    public void buildClassifier(
            Instances data) throws Exception {

        if (data == null) {
            throw new IllegalArgumentException(
                    "Dataset cannot be null."
            );
        }

        if (data.numInstances() < 10) {
            throw new IllegalArgumentException(
                    "At least 10 observations are required " +
                    "for a three-factor quadratic RSM model."
            );
        }

        if (data.classIndex() < 0) {
            throw new IllegalArgumentException(
                    "Target/class attribute is not set."
            );
        }

        if (data.numAttributes() - 1 != 3) {
            throw new IllegalArgumentException(
                    "RSM Quadratic Regression requires exactly " +
                    "3 input parameters. Found: " +
                    (data.numAttributes() - 1)
            );
        }

        for (int i = 0; i < 3; i++) {

            if (!data.attribute(i).isNumeric()) {

                throw new IllegalArgumentException(
                        "RSM input parameter must be numeric: " +
                        data.attribute(i).name()
                );
            }
        }

        if (!data.classAttribute().isNumeric()) {
            throw new IllegalArgumentException(
                    "RSM target must be numeric."
            );
        }

 
        determineCoding(data);


        determineAlpha(data);

        double[][] designMatrix =
                new double[data.numInstances()][10];

        double[] response =
                new double[data.numInstances()];

        for (int row = 0;
             row < data.numInstances();
             row++) {

            Instance instance =
                    data.instance(row);

            double x1 =
                    toCoded(
                            instance.value(0),
                            0
                    );

            double x2 =
                    toCoded(
                            instance.value(1),
                            1
                    );

            double x3 =
                    toCoded(
                            instance.value(2),
                            2
                    );

            designMatrix[row] =
                    createQuadraticTerms(
                            x1,
                            x2,
                            x3
                    );

            response[row] =
                    instance.classValue();
        }

        coefficients =
                solveLeastSquares(
                        designMatrix,
                        response
                );

        trained = true;
    }



    private void determineCoding(
            Instances data) {

        centers = new double[3];
        steps = new double[3];

        for (int column = 0;
             column < 3;
             column++) {

            double[] values =
                    new double[
                            data.numInstances()
                    ];

            for (int row = 0;
                 row < data.numInstances();
                 row++) {

                values[row] =
                        data.instance(row)
                                .value(column);
            }

            Arrays.sort(values);

            double bestValue =
                    values[0];

            int bestCount = 1;

            int currentCount = 1;

            for (int i = 1;
                 i < values.length;
                 i++) {

                if (Math.abs(
                        values[i] -
                                values[i - 1]
                ) < 1.0e-8) {

                    currentCount++;

                } else {

                    if (currentCount >
                            bestCount) {

                        bestCount =
                                currentCount;

                        bestValue =
                                values[i - 1];
                    }

                    currentCount = 1;
                }
            }

            if (currentCount >
                    bestCount) {

                bestValue =
                        values[values.length - 1];
            }

            centers[column] =
                    bestValue;

           
            double smallestDistance =
                    Double.POSITIVE_INFINITY;

            for (double value : values) {

                double distance =
                        Math.abs(
                                value -
                                        centers[column]
                        );

                if (distance > 1.0e-8 &&
                        distance < smallestDistance) {

                    smallestDistance =
                            distance;
                }
            }

            if (!Double.isFinite(
                    smallestDistance
            ) || smallestDistance <= 0.0) {

                throw new IllegalArgumentException(
                        "Unable to determine RSM coding step " +
                        "for parameter " +
                        data.attribute(column).name()
                );
            }

            steps[column] =
                    smallestDistance;
        }
    }

 

    private void determineAlpha(
            Instances data) {

        alpha = 1.0;

        for (int row = 0;
             row < data.numInstances();
             row++) {

            for (int column = 0;
                 column < 3;
                 column++) {

                double coded =
                        Math.abs(
                                toCoded(
                                        data.instance(row)
                                                .value(column),
                                        column
                                )
                        );

                if (coded > alpha) {
                    alpha = coded;
                }
            }
        }
    }


    public double toCoded(
            double actual,
            int factor) {

        return (
                actual -
                        centers[factor]
        ) / steps[factor];
    }

    public double toActual(
            double coded,
            int factor) {

        return centers[factor] +
                coded * steps[factor];
    }


    @Override
    public double classifyInstance(
            Instance instance) throws Exception {

        if (!trained) {

            throw new IllegalStateException(
                    "RSM model has not been trained."
            );
        }

        if (instance == null) {

            throw new IllegalArgumentException(
                    "Instance cannot be null."
            );
        }

        if (instance.dataset() == null) {

            throw new IllegalArgumentException(
                    "Instance must belong to a dataset."
            );
        }

        if (instance.dataset()
                .numAttributes() - 1 != 3) {

            throw new IllegalArgumentException(
                    "RSM requires exactly 3 input parameters."
            );
        }

        double x1 =
                toCoded(
                        instance.value(0),
                        0
                );

        double x2 =
                toCoded(
                        instance.value(1),
                        1
                );

        double x3 =
                toCoded(
                        instance.value(2),
                        2
                );

        double[] terms =
                createQuadraticTerms(
                        x1,
                        x2,
                        x3
                );

        double prediction = 0.0;

        for (int i = 0;
             i < coefficients.length;
             i++) {

            prediction +=
                    coefficients[i] *
                            terms[i];
        }

        return prediction;
    }


    private double[] createQuadraticTerms(
            double x1,
            double x2,
            double x3) {

        return new double[] {

                1.0,

                x1,
                x2,
                x3,

                x1 * x2,
                x1 * x3,
                x2 * x3,

                x1 * x1,
                x2 * x2,
                x3 * x3
        };
    }

    private double[] solveLeastSquares(
            double[][] X,
            double[] y) throws Exception {

        int rows = X.length;
        int columns = X[0].length;

        double[][] normal =
                new double[columns][columns];

        double[] rhs =
                new double[columns];

        for (int i = 0;
             i < columns;
             i++) {

            for (int j = 0;
                 j < columns;
                 j++) {

                double sum = 0.0;

                for (int row = 0;
                     row < rows;
                     row++) {

                    sum +=
                            X[row][i] *
                                    X[row][j];
                }

                normal[i][j] =
                        sum;
            }

            double sum = 0.0;

            for (int row = 0;
                 row < rows;
                 row++) {

                sum +=
                        X[row][i] *
                                y[row];
            }

            rhs[i] =
                    sum;
        }

        double ridge =
                1.0e-10;

        for (int i = 0;
             i < columns;
             i++) {

            normal[i][i] += ridge;
        }

        return gaussianElimination(
                normal,
                rhs
        );
    }



    private double[] gaussianElimination(
            double[][] matrix,
            double[] vector)
            throws Exception {

        int n =
                vector.length;

        double[][] a =
                new double[n][n + 1];

        for (int i = 0;
             i < n;
             i++) {

            for (int j = 0;
                 j < n;
                 j++) {

                a[i][j] =
                        matrix[i][j];
            }

            a[i][n] =
                    vector[i];
        }

        for (int pivot = 0;
             pivot < n;
             pivot++) {

            int maxRow =
                    pivot;

            double maxValue =
                    Math.abs(
                            a[pivot][pivot]
                    );

            for (int row = pivot + 1;
                 row < n;
                 row++) {

                double value =
                        Math.abs(
                                a[row][pivot]
                        );

                if (value > maxValue) {

                    maxValue =
                            value;

                    maxRow =
                            row;
                }
            }

            if (maxValue < 1.0e-12) {

                throw new Exception(
                        "RSM quadratic system is singular."
                );
            }

            if (maxRow != pivot) {

                double[] temp =
                        a[pivot];

                a[pivot] =
                        a[maxRow];

                a[maxRow] =
                        temp;
            }

            double pivotValue =
                    a[pivot][pivot];

            for (int column = pivot;
                 column <= n;
                 column++) {

                a[pivot][column] /=
                        pivotValue;
            }

            for (int row = 0;
                 row < n;
                 row++) {

                if (row == pivot) {
                    continue;
                }

                double factor =
                        a[row][pivot];

                for (int column = pivot;
                     column <= n;
                     column++) {

                    a[row][column] -=
                            factor *
                                    a[pivot][column];
                }
            }
        }

        double[] solution =
                new double[n];

        for (int i = 0;
             i < n;
             i++) {

            solution[i] =
                    a[i][n];
        }

        return solution;
    }

    public double[] getStationaryPointCoded() {

        if (!trained) {

            throw new IllegalStateException(
                    "RSM model has not been trained."
            );
        }


        double[][] H =
                new double[3][3];

        H[0][0] =
                2.0 * coefficients[7];

        H[0][1] =
                coefficients[4];

        H[0][2] =
                coefficients[5];

        H[1][0] =
                coefficients[4];

        H[1][1] =
                2.0 * coefficients[8];

        H[1][2] =
                coefficients[6];

        H[2][0] =
                coefficients[5];

        H[2][1] =
                coefficients[6];

        H[2][2] =
                2.0 * coefficients[9];

        double[] linear = {

                coefficients[1],
                coefficients[2],
                coefficients[3]
        };

        return solve3x3(
                H,
                negate(linear)
        );
    }



    public double[] getStationaryPointActual() {

        double[] coded =
                getStationaryPointCoded();

        return new double[] {

                toActual(coded[0], 0),
                toActual(coded[1], 1),
                toActual(coded[2], 2)
        };
    }

  

    public boolean isStationaryPointWithinCCD() {

        double[] point =
                getStationaryPointCoded();

        for (double value : point) {

            if (value < -alpha - 1.0e-8 ||
                    value > alpha + 1.0e-8) {

                return false;
            }
        }

        return true;
    }



    public double getAlpha() {
        return alpha;
    }


    public double[] getCoefficients() {

        if (coefficients == null) {
            return null;
        }

        return coefficients.clone();
    }


    public double[] getCenters() {

        return centers.clone();
    }



    public double[] getSteps() {

        return steps.clone();
    }



    private double[] solve3x3(
            double[][] matrix,
            double[] vector) {

        double[][] a =
                new double[3][4];

        for (int i = 0;
             i < 3;
             i++) {

            for (int j = 0;
                 j < 3;
                 j++) {

                a[i][j] =
                        matrix[i][j];
            }

            a[i][3] =
                    vector[i];
        }

        for (int pivot = 0;
             pivot < 3;
             pivot++) {

            int maxRow =
                    pivot;

            for (int row = pivot + 1;
                 row < 3;
                 row++) {

                if (Math.abs(
                        a[row][pivot]
                ) >
                        Math.abs(
                                a[maxRow][pivot]
                        )) {

                    maxRow =
                            row;
                }
            }

            if (Math.abs(
                    a[maxRow][pivot]
            ) < 1.0e-12) {

                throw new IllegalStateException(
                        "Unable to determine RSM stationary point."
                );
            }

            double[] temp =
                    a[pivot];

            a[pivot] =
                    a[maxRow];

            a[maxRow] =
                    temp;

            for (int row = pivot + 1;
                 row < 3;
                 row++) {

                double factor =
                        a[row][pivot] /
                                a[pivot][pivot];

                for (int column = pivot;
                     column < 4;
                     column++) {

                    a[row][column] -=
                            factor *
                                    a[pivot][column];
                }
            }
        }

        double[] result =
                new double[3];

        for (int i = 2;
             i >= 0;
             i--) {

            double sum =
                    a[i][3];

            for (int j = i + 1;
                 j < 3;
                 j++) {

                sum -=
                        a[i][j] *
                                result[j];
            }

            result[i] =
                    sum /
                            a[i][i];
        }

        return result;
    }

    private double[] negate(
            double[] values) {

        double[] result =
                new double[values.length];

        for (int i = 0;
             i < values.length;
             i++) {

            result[i] =
                    -values[i];
        }

        return result;
    }


    @Override
    public String toString() {

        if (!trained) {

            return "RSM Quadratic Regression: Not trained";
        }

        return String.format(
                "RSM Quadratic Regression%n%n" +
                "Y = %.6f " +
                "+ %.6f X1 " +
                "+ %.6f X2 " +
                "+ %.6f X3 " +
                "+ %.6f X1X2 " +
                "+ %.6f X1X3 " +
                "+ %.6f X2X3 " +
                "+ %.6f X1^2 " +
                "+ %.6f X2^2 " +
                "+ %.6f X3^2%n",
                coefficients[0],
                coefficients[1],
                coefficients[2],
                coefficients[3],
                coefficients[4],
                coefficients[5],
                coefficients[6],
                coefficients[7],
                coefficients[8],
                coefficients[9]
        );
    }
}