package com.enzyme.optimizer.api;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.enzyme.optimizer.data.TrainedModelStore;
import com.enzyme.optimizer.model.ModelResult;
import com.enzyme.optimizer.model.ModelTrainer;

import weka.core.Attribute;
import weka.core.DenseInstance;
import weka.core.Instances;
import weka.core.Utils;

@RestController
@RequestMapping("/api/predictions")
@CrossOrigin(origins = "http://localhost:5173")
public class PredictionController {

    private static final int MAX_POINTS = 5000;

    private final TrainedModelStore trainedModels;

    public PredictionController(TrainedModelStore trainedModels) {
        this.trainedModels = trainedModels;
    }



    @GetMapping("/info")
    public Map<String, Object> info() {

        requireModels();

        Instances dataset = trainedModels.getDataset();

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("targetColumn", trainedModels.getTargetColumn());
        response.put("factors", describeFactors(dataset));

        List<String> names = new ArrayList<>();
        for (ModelResult result : trainedModels.getResults()) {
            names.add(result.getModelName());
        }
        response.put("models", names);

        return response;
    }


    @PostMapping
    public Map<String, Object> predict(
            @RequestBody Map<String, Object> request) {

        requireModels();

        if (request == null) {
            throw bad("Request body is required.");
        }

        Instances dataset = trainedModels.getDataset();

        List<ModelResult> selected = selectModels(request.get("model"));

        List<Map<String, Object>> points = readPoints(request);

        Map<String, double[]> ranges = numericRanges(dataset);

        List<Map<String, Object>> predictions = new ArrayList<>();

        for (Map<String, Object> point : points) {

            DenseInstance instance = buildInstance(dataset, point);

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("inputs", point);

            Map<String, Object> values = new LinkedHashMap<>();

            for (ModelResult result : selected) {

                try {
                    double value =
                        result.getModel().classifyInstance(instance);

                    values.put(
                        result.getModelName(),
                        Double.isNaN(value) || Double.isInfinite(value)
                            ? null : value);

                } catch (Exception e) {
                    values.put(result.getModelName(), null);
                }
            }

            entry.put("values", values);

            List<String> outside = outOfRange(dataset, instance, ranges);
            entry.put("extrapolation", !outside.isEmpty());

            if (!outside.isEmpty()) {
                entry.put("outOfRange", outside);
            }

            predictions.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("targetColumn", trainedModels.getTargetColumn());

        List<String> names = new ArrayList<>();
        for (ModelResult result : selected) {
            names.add(result.getModelName());
        }
        response.put("models", names);
        response.put("predictions", predictions);

        return response;
    }


    private void requireModels() {
        if (!trainedModels.hasModels()) {
            throw bad(
                "No trained models are available. "
                + "Upload a dataset and run the optimization first.");
        }
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST, message);
    }

    private List<ModelResult> selectModels(Object requested) {

        List<ModelResult> all = trainedModels.getResults();

        if (requested == null
                || requested.toString().trim().isEmpty()
                || "all".equalsIgnoreCase(requested.toString().trim())) {
            return all;
        }

        String wanted = requested.toString().trim();

        if ("ann".equalsIgnoreCase(wanted)
                || "neural network".equalsIgnoreCase(wanted)) {
            wanted = ModelTrainer.ANN_NAME;
        }

        for (ModelResult result : all) {
            if (result.getModelName().equalsIgnoreCase(wanted)) {
                return List.of(result);
            }
        }

        List<String> names = new ArrayList<>();
        for (ModelResult result : all) {
            names.add(result.getModelName());
        }

        throw bad("Unknown model '" + requested
                + "'. Available models: " + names);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> readPoints(
            Map<String, Object> request) {

        List<Map<String, Object>> points = new ArrayList<>();

        Object many = request.get("points");
        Object one = request.get("inputs");

        if (many instanceof List<?>) {
            for (Object item : (List<?>) many) {
                if (!(item instanceof Map<?, ?>)) {
                    throw bad("Every entry of 'points' must be an object "
                            + "of factor values.");
                }
                points.add((Map<String, Object>) item);
            }
        }

        if (one instanceof Map<?, ?>) {
            points.add((Map<String, Object>) one);
        }

        if (points.isEmpty()) {
            throw bad("Provide 'inputs' (one point) or 'points' "
                    + "(a list of points).");
        }

        if (points.size() > MAX_POINTS) {
            throw bad("At most " + MAX_POINTS
                    + " points can be predicted per request.");
        }

        return points;
    }

    private static Object lookup(
            Map<String, Object> point, String name) {

        if (point.containsKey(name)) {
            return point.get(name);
        }

        for (Map.Entry<String, Object> entry : point.entrySet()) {
            if (entry.getKey() != null
                    && entry.getKey().trim()
                        .equalsIgnoreCase(name.trim())) {
                return entry.getValue();
            }
        }

        return null;
    }

    private static DenseInstance buildInstance(
            Instances dataset,
            Map<String, Object> point) {

        double[] values = new double[dataset.numAttributes()];

        for (int i = 0; i < values.length; i++) {

            if (i == dataset.classIndex()) {
                values[i] = Utils.missingValue();
                continue;
            }

            Attribute attribute = dataset.attribute(i);
            Object raw = lookup(point, attribute.name());

            if (raw == null || raw.toString().trim().isEmpty()) {
                throw bad("Missing value for factor '"
                        + attribute.name() + "'.");
            }

            if (attribute.isNumeric()) {

                double number;

                try {
                    number = (raw instanceof Number)
                        ? ((Number) raw).doubleValue()
                        : Double.parseDouble(raw.toString().trim());
                } catch (NumberFormatException e) {
                    throw bad("Factor '" + attribute.name()
                            + "' must be numeric (got '" + raw + "').");
                }

                if (Double.isNaN(number) || Double.isInfinite(number)) {
                    throw bad("Factor '" + attribute.name()
                            + "' must be a finite number.");
                }

                values[i] = number;

            } else {

                String label = raw.toString().trim();
                int index = attribute.indexOfValue(label);

                if (index < 0) {

                    List<String> allowed = new ArrayList<>();
                    for (int v = 0; v < attribute.numValues(); v++) {
                        allowed.add(attribute.value(v));
                    }

                    throw bad("Factor '" + attribute.name()
                            + "' has unknown category '" + label
                            + "'. Allowed: " + allowed);
                }

                values[i] = index;
            }
        }

        DenseInstance instance = new DenseInstance(1.0, values);
        instance.setDataset(dataset);

        return instance;
    }

    private static Map<String, double[]> numericRanges(
            Instances dataset) {

        Map<String, double[]> ranges = new LinkedHashMap<>();

        for (int i = 0; i < dataset.numAttributes(); i++) {

            if (i == dataset.classIndex()
                    || !dataset.attribute(i).isNumeric()) {
                continue;
            }

            double min = Double.POSITIVE_INFINITY;
            double max = Double.NEGATIVE_INFINITY;

            for (int row = 0; row < dataset.numInstances(); row++) {
                double v = dataset.instance(row).value(i);
                if (Double.isNaN(v)) {
                    continue;
                }
                min = Math.min(min, v);
                max = Math.max(max, v);
            }

            ranges.put(dataset.attribute(i).name(),
                    new double[] { min, max });
        }

        return ranges;
    }

    private static List<String> outOfRange(
            Instances dataset,
            DenseInstance instance,
            Map<String, double[]> ranges) {

        List<String> outside = new ArrayList<>();

        for (Map.Entry<String, double[]> entry : ranges.entrySet()) {

            Attribute attribute = dataset.attribute(entry.getKey());
            double v = instance.value(attribute);
            double[] range = entry.getValue();

            if (v < range[0] - 1e-9 || v > range[1] + 1e-9) {
                outside.add(entry.getKey());
            }
        }

        return outside;
    }

    private static List<Map<String, Object>> describeFactors(
            Instances dataset) {

        Map<String, double[]> ranges = numericRanges(dataset);
        List<Map<String, Object>> factors = new ArrayList<>();

        for (int i = 0; i < dataset.numAttributes(); i++) {

            if (i == dataset.classIndex()) {
                continue;
            }

            Attribute attribute = dataset.attribute(i);
            Map<String, Object> factor = new LinkedHashMap<>();

            factor.put("name", attribute.name());

            if (attribute.isNumeric()) {
                double[] range = ranges.get(attribute.name());
                factor.put("type", "numeric");
                factor.put("min", range[0]);
                factor.put("max", range[1]);
            } else {
                List<String> categories = new ArrayList<>();
                for (int v = 0; v < attribute.numValues(); v++) {
                    categories.add(attribute.value(v));
                }
                factor.put("type", "categorical");
                factor.put("categories", categories);
            }

            factors.add(factor);
        }

        return factors;
    }
}
