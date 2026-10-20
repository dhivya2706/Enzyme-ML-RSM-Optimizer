package com.enzyme.optimizer.util;

public class StatisticalUtil {

    public static double mean(
            double[] values) {

        if (values == null ||
            values.length == 0) {

            return 0.0;
        }

        double sum = 0.0;

        for (double value : values) {
            sum += value;
        }

        return sum / values.length;
    }

    public static double mse(
            double[] actual,
            double[] predicted) {

        checkLength(
                actual,
                predicted
        );

        if (actual.length == 0) {
            return 0.0;
        }

        double sum = 0.0;

        for (int i = 0;
             i < actual.length;
             i++) {

            double error =
                    actual[i] -
                    predicted[i];

            sum += error * error;
        }

        return sum / actual.length;
    }

    public static double rmse(
            double[] actual,
            double[] predicted) {

        return Math.sqrt(
                mse(
                        actual,
                        predicted
                )
        );
    }

    public static double mae(
            double[] actual,
            double[] predicted) {

        checkLength(
                actual,
                predicted
        );

        if (actual.length == 0) {
            return 0.0;
        }

        double sum = 0.0;

        for (int i = 0;
             i < actual.length;
             i++) {

            sum += Math.abs(
                    actual[i] -
                    predicted[i]
            );
        }

        return sum / actual.length;
    }

    public static double rSquared(
            double[] actual,
            double[] predicted) {

        checkLength(
                actual,
                predicted
        );

        if (actual.length == 0) {
            return 0.0;
        }

        double mean =
                mean(actual);

        double ssTotal = 0.0;
        double ssResidual = 0.0;

        for (int i = 0;
             i < actual.length;
             i++) {

            ssTotal +=
                    Math.pow(
                            actual[i] - mean,
                            2
                    );

            ssResidual +=
                    Math.pow(
                            actual[i] -
                            predicted[i],
                            2
                    );
        }

        if (ssTotal == 0.0) {
            return 0.0;
        }

        return 1.0 -
                (ssResidual / ssTotal);
    }

    public static double standardDeviation(
            double[] values) {

        return Math.sqrt(
                variance(values)
        );
    }

    public static double variance(
            double[] values) {

        if (values == null ||
            values.length == 0) {

            return 0.0;
        }

        double mean =
                mean(values);

        double sum = 0.0;

        for (double value : values) {

            sum +=
                    Math.pow(
                            value - mean,
                            2
                    );
        }

        return sum / values.length;
    }

    public static double min(
            double[] values) {

        if (values == null ||
            values.length == 0) {

            return Double.NaN;
        }

        double min =
                values[0];

        for (double value : values) {

            if (value < min) {
                min = value;
            }
        }

        return min;
    }

    public static double max(
            double[] values) {

        if (values == null ||
            values.length == 0) {

            return Double.NaN;
        }

        double max =
                values[0];

        for (double value : values) {

            if (value > max) {
                max = value;
            }
        }

        return max;
    }

    private static void checkLength(
            double[] actual,
            double[] predicted) {

        if (actual == null ||
            predicted == null) {

            throw new IllegalArgumentException(
                    "Arrays cannot be null."
            );
        }

        if (actual.length !=
                predicted.length) {

            throw new IllegalArgumentException(
                    "Arrays must have the same length."
            );
        }
    }
}