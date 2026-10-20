
package com.enzyme.optimizer.data;

import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;

@Component
public class UploadedDatasetStore {

    private List<Map<String, String>> rows;
    private String fileName;

    public synchronized void save(
            String fileName,
            List<Map<String, String>> rows) {
        this.fileName = fileName;
        this.rows = List.copyOf(rows);
    }

    public synchronized List<Map<String, String>> getRows() {
        return rows;
    }

    public synchronized String getFileName() {
        return fileName;
    }

    public synchronized boolean hasDataset() {
        return rows != null && !rows.isEmpty();
    }
}
