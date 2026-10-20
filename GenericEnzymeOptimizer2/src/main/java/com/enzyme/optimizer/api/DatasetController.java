
package com.enzyme.optimizer.api;

import com.enzyme.optimizer.data.ExcelReader;
import com.enzyme.optimizer.data.UploadedDatasetStore;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@RestController
@RequestMapping("/api/datasets")
@CrossOrigin(origins = "http://localhost:5173")
public class DatasetController {

    private final UploadedDatasetStore store;

    public DatasetController(UploadedDatasetStore store) {
        this.store = store;
    }

    @PostMapping("/upload")
    public Map<String, Object> upload(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Please select a file.");
        }

        String fileName = file.getOriginalFilename();

        if (fileName == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Filename is missing.");
        }

        String lower = fileName.toLowerCase(Locale.ROOT);

        if (!(lower.endsWith(".csv")
                || lower.endsWith(".xls")
                || lower.endsWith(".xlsx"))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only CSV, XLS, and XLSX files are supported.");
        }

        Path tempFile = null;

        try {
            String suffix = lower.endsWith(".xlsx") ? ".xlsx"
                    : lower.endsWith(".xls") ? ".xls" : ".csv";

            tempFile = Files.createTempFile("enzyme-upload-", suffix);
            file.transferTo(tempFile);

            var rows = ExcelReader.readFile(tempFile.toString());

            if (rows.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "The uploaded file contains no data rows.");
            }

            List<String> columns =
                    new ArrayList<>(rows.get(0).keySet());

            store.save(fileName, rows);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "Dataset uploaded successfully.");
            response.put("fileName", fileName);
            response.put("rowCount", rows.size());
            response.put("columns", columns);
            response.put("defaultTargetColumn",
                    columns.contains("ObservedActivity_U_ml")
                            ? "ObservedActivity_U_ml" : null);

            return response;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Could not read dataset: " + e.getMessage(), e);
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {
                    
                }
            }
        }
    }
}
