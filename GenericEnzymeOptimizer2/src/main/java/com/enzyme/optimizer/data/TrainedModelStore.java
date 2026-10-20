package com.enzyme.optimizer.data;

import java.util.List;

import org.springframework.stereotype.Component;

import com.enzyme.optimizer.model.ModelResult;

import weka.core.Instances;


@Component
public class TrainedModelStore {

    private Instances dataset;
    private String targetColumn;
    private List<ModelResult> results;

    public synchronized void save(
            Instances dataset,
            String targetColumn,
            List<ModelResult> results) {

        this.dataset = dataset;
        this.targetColumn = targetColumn;
        this.results = List.copyOf(results);
    }

    public synchronized void clear() {
        this.dataset = null;
        this.targetColumn = null;
        this.results = null;
    }

    public synchronized boolean hasModels() {
        return results != null && !results.isEmpty();
    }

    public synchronized Instances getDataset() {
        return dataset;
    }

    public synchronized String getTargetColumn() {
        return targetColumn;
    }

    public synchronized List<ModelResult> getResults() {
        return results;
    }
}
