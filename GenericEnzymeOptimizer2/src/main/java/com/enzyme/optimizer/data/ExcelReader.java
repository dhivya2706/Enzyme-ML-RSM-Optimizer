package com.enzyme.optimizer.data;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

public class ExcelReader {


    public static List<Map<String, String>> readFile(
            String filePath) throws Exception {

        if (filePath == null ||
            filePath.trim().isEmpty()) {

            throw new IllegalArgumentException(
                    "File path cannot be empty."
            );
        }

        String lower =
                filePath.toLowerCase(Locale.ROOT);

        if (lower.endsWith(".xlsx") ||
            lower.endsWith(".xls")) {

            return readExcel(filePath);

        } else if (lower.endsWith(".csv")) {

            return readCSV(filePath);

        } else {

            throw new IllegalArgumentException(
                    "Unsupported file format.\n\n" +
                    "Supported formats:\n" +
                    ".xlsx\n" +
                    ".xls\n" +
                    ".csv"
            );
        }
    }



    public static List<Map<String, String>> readExcel(
            String filePath) throws Exception {

        List<Map<String, String>> data =
                new ArrayList<>();

        try (
                FileInputStream fis =
                        new FileInputStream(filePath);

                Workbook workbook =
                        WorkbookFactory.create(fis)
        ) {

            if (workbook.getNumberOfSheets() == 0) {

                throw new IllegalArgumentException(
                        "Excel workbook contains no sheets."
                );
            }

            Sheet sheet =
                    workbook.getSheetAt(0);

            Iterator<Row> rows =
                    sheet.iterator();

            if (!rows.hasNext()) {

                throw new IllegalArgumentException(
                        "Excel file is empty."
                );
            }

            Row headerRow =
                    rows.next();

            List<String> headers =
                    new ArrayList<>();

            for (Cell cell : headerRow) {

                String header =
                        cell.toString().trim();

                if (header.isEmpty()) {
                    header = "Column_" +
                            headers.size();
                }

                headers.add(header);
            }

            while (rows.hasNext()) {

                Row row =
                        rows.next();

                Map<String, String> record =
                        new LinkedHashMap<>();

                boolean hasData = false;

                for (int i = 0;
                     i < headers.size();
                     i++) {

                    Cell cell =
                            row.getCell(
                                    i,
                                    Row.MissingCellPolicy
                                            .CREATE_NULL_AS_BLANK
                            );

                    String value =
                            cell.toString().trim();

                    if (!value.isEmpty()) {
                        hasData = true;
                    }

                    record.put(
                            headers.get(i),
                            value
                    );
                }

                if (hasData) {
                    data.add(record);
                }
            }
        }

        return data;
    }


    public static List<Map<String, String>> readCSV(
            String filePath) throws Exception {

        List<Map<String, String>> data =
                new ArrayList<>();

        try (
                BufferedReader reader =
                        new BufferedReader(
                                new InputStreamReader(
                                        new FileInputStream(filePath),
                                        StandardCharsets.UTF_8
                                )
                        )
        ) {

            String headerLine =
                    reader.readLine();

            if (headerLine == null ||
                headerLine.trim().isEmpty()) {

                throw new IllegalArgumentException(
                        "CSV file is empty."
                );
            }

            // Remove UTF-8 BOM if present
            headerLine =
                    removeBOM(headerLine);

            char delimiter =
                    detectDelimiter(headerLine);

            List<String> headers =
                    parseCSVLine(
                            headerLine,
                            delimiter
                    );

            for (int i = 0;
                 i < headers.size();
                 i++) {

                String header =
                        headers.get(i).trim();

                if (header.isEmpty()) {

                    header =
                            "Column_" + i;
                }

                headers.set(i, header);
            }

            String line;

            while ((line =
                    reader.readLine()) != null) {

                if (line.trim().isEmpty()) {
                    continue;
                }

                List<String> values =
                        parseCSVLine(
                                line,
                                delimiter
                        );

                Map<String, String> record =
                        new LinkedHashMap<>();

                boolean hasData = false;

                for (int i = 0;
                     i < headers.size();
                     i++) {

                    String value = "";

                    if (i < values.size()) {

                        value =
                                values.get(i).trim();
                    }

                    if (!value.isEmpty()) {
                        hasData = true;
                    }

                    record.put(
                            headers.get(i),
                            value
                    );
                }

                if (hasData) {
                    data.add(record);
                }
            }
        }

        return data;
    }



    private static char detectDelimiter(
            String line) {

        int comma =
                countCharacterOutsideQuotes(
                        line, ','
                );

        int semicolon =
                countCharacterOutsideQuotes(
                        line, ';'
                );

        int tab =
                countCharacterOutsideQuotes(
                        line, '\t'
                );

        if (semicolon > comma &&
            semicolon >= tab) {

            return ';';
        }

        if (tab > comma &&
            tab > semicolon) {

            return '\t';
        }

        return ',';
    }

    private static int countCharacterOutsideQuotes(
            String line,
            char target) {

        boolean insideQuotes = false;
        int count = 0;

        for (int i = 0;
             i < line.length();
             i++) {

            char c = line.charAt(i);

            if (c == '"') {

                if (insideQuotes &&
                    i + 1 < line.length() &&
                    line.charAt(i + 1) == '"') {

                    i++;

                } else {

                    insideQuotes =
                            !insideQuotes;
                }

            } else if (c == target &&
                       !insideQuotes) {

                count++;
            }
        }

        return count;
    }

   

    private static List<String> parseCSVLine(
            String line,
            char delimiter) {

        List<String> values =
                new ArrayList<>();

        StringBuilder current =
                new StringBuilder();

        boolean insideQuotes = false;

        for (int i = 0;
             i < line.length();
             i++) {

            char c = line.charAt(i);

            if (c == '"') {

                if (insideQuotes &&
                    i + 1 < line.length() &&
                    line.charAt(i + 1) == '"') {

                    current.append('"');
                    i++;

                } else {

                    insideQuotes =
                            !insideQuotes;
                }

            } else if (c == delimiter &&
                       !insideQuotes) {

                values.add(
                        current.toString()
                );

                current.setLength(0);

            } else {

                current.append(c);
            }
        }

        values.add(
                current.toString()
        );

        return values;
    }

    private static String removeBOM(
            String text) {

        if (text != null &&
            !text.isEmpty() &&
            text.charAt(0) == '\uFEFF') {

            return text.substring(1);
        }

        return text;
    }
}