package com.enzyme.optimizer.data;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import weka.core.Attribute;
import weka.core.DenseInstance;
import weka.core.Instances;

public class DatasetProcessor {

    public static Instances convertToWeka(
            List<Map<String, String>> rows,
            String targetColumn) {

        if (rows == null || rows.isEmpty()) {
            throw new IllegalArgumentException("Dataset is empty.");
        }

        if (targetColumn == null || targetColumn.trim().isEmpty()) {
            throw new IllegalArgumentException("Target column is not selected.");
        }

        Map<String, String> firstRow = rows.get(0);

        ArrayList<Attribute> attributes = new ArrayList<>();
        List<String> inputColumns = new ArrayList<>();


        for (String column : firstRow.keySet()) {

            if (column.equalsIgnoreCase(targetColumn)) {
                continue;
            }

            String lower = column.toLowerCase();

            if (lower.endsWith("_coded")) {
                continue;
            }


            if (lower.contains("predicted")
                    || lower.contains("prediction")) {
                continue;
            }


            if (isIdentifierColumn(column)) {
                continue;
            }

            if (isNumericColumn(rows, column)) {

                attributes.add(new Attribute(column));
                inputColumns.add(column);

            }


            else {

                List<String> categories =
                        getUniqueCategories(rows, column);

                if (categories.size() >= 2) {

                    attributes.add(
                            new Attribute(column, categories));

                    inputColumns.add(column);
                }
            }
        }



        if (!isNumericColumn(rows, targetColumn)) {
            throw new IllegalArgumentException(
                    "Target column must be numeric: " + targetColumn);
        }

        attributes.add(new Attribute(targetColumn));



        Instances dataset =
                new Instances(
                        "EnzymeDataset",
                        attributes,
                        rows.size());

        dataset.setClassIndex(attributes.size() - 1);


        for (Map<String, String> row : rows) {

            double[] values =
                    new double[attributes.size()];

            boolean valid = true;

            for (int i = 0; i < attributes.size(); i++) {

                String column =
                        attributes.get(i).name();

                String value = row.get(column);

                if (value == null
                        || value.trim().isEmpty()) {

                    valid = false;
                    break;
                }

                Attribute attribute =
                        attributes.get(i);



                if (attribute.isNumeric()) {

                    try {

                        values[i] =
                                Double.parseDouble(
                                        value.trim());

                    } catch (NumberFormatException e) {

                        valid = false;
                        break;
                    }

                }

                else if (attribute.isNominal()) {

                    int categoryIndex =
                            attribute.indexOfValue(
                                    value.trim());

                    if (categoryIndex < 0) {

                        valid = false;
                        break;
                    }

                    values[i] = categoryIndex;
                }
            }

            if (valid) {

                dataset.add(
                        new DenseInstance(
                                1.0,
                                values));
            }
        }

        if (dataset.numInstances() == 0) {

            throw new IllegalArgumentException(
                    "No valid rows found after preprocessing.");
        }

        return dataset;
    }


    private static boolean isNumericColumn(
            List<Map<String, String>> rows,
            String column) {

        int numericCount = 0;
        int validCount = 0;

        for (Map<String, String> row : rows) {

            String value = row.get(column);

            if (value == null
                    || value.trim().isEmpty()) {
                continue;
            }

            validCount++;

            try {

                Double.parseDouble(value.trim());
                numericCount++;

            } catch (NumberFormatException ignored) {
            }
        }

        if (validCount == 0) {
            return false;
        }

        return numericCount >=
                Math.max(1, validCount / 2);
    }


    private static List<String> getUniqueCategories(
            List<Map<String, String>> rows,
            String column) {

        Set<String> uniqueValues =
                new LinkedHashSet<>();

        for (Map<String, String> row : rows) {

            String value = row.get(column);

            if (value != null
                    && !value.trim().isEmpty()) {

                uniqueValues.add(value.trim());
            }
        }

        return new ArrayList<>(uniqueValues);
    }


    private static boolean isIdentifierColumn(
            String column) {

        String c = column.toLowerCase()
                .replace("_", "")
                .replace("-", "")
                .replace(" ", "");

        return c.equals("id")
                || c.equals("run")
                || c.equals("std")
                || c.equals("index")
                || c.equals("no")
                || c.equals("number")
                || c.equals("experiment")
                || c.equals("trial")
                || c.equals("sampleid")
                || c.equals("sample");
    }

    

    public static List<String> getInputColumns(
            Instances dataset) {

        List<String> columns =
                new ArrayList<>();

        for (int i = 0;
             i < dataset.numAttributes();
             i++) {

            if (i != dataset.classIndex()) {

                columns.add(
                        dataset.attribute(i).name());
            }
        }

        return columns;
    }
}