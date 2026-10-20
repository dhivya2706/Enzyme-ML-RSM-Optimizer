package com.enzyme.optimizer;

import java.awt.BorderLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.io.File;
import java.util.List;
import java.util.Map;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;

import com.enzyme.optimizer.data.DatasetAnalyzer;
import com.enzyme.optimizer.data.DatasetProcessor;
import com.enzyme.optimizer.data.ExcelReader;
import com.enzyme.optimizer.data.ExperimentalDesignDetector;
import com.enzyme.optimizer.model.ModelResult;
import com.enzyme.optimizer.model.ModelStrategy;
import com.enzyme.optimizer.model.ModelTrainer;
import com.enzyme.optimizer.optimization.ParameterOptimizer;

import weka.core.Attribute;
import weka.core.Instances;

public class EnzymeOptimizerGUI extends JFrame {

    private JTextField enzymeField;
    private JTextField fileField;

    private JComboBox<String> targetCombo;

    private JTextArea resultArea;

    private List<Map<String, String>> rawData;

    public EnzymeOptimizerGUI() {

        setTitle(
                "Universal Enzyme ML + RSM Optimizer"
        );

        setSize(950, 750);

        setDefaultCloseOperation(
                JFrame.EXIT_ON_CLOSE
        );

        setLocationRelativeTo(null);

        createUI();
    }
    private void createUI() {

        JPanel mainPanel
                = new JPanel(
                        new BorderLayout(
                                10,
                                10
                        )
                );

        JPanel inputPanel
                = new JPanel(
                        new GridLayout(
                                4,
                                2,
                                10,
                                10
                        )
                );

        inputPanel.setBorder(
                BorderFactory.createEmptyBorder(
                        20,
                        20,
                        10,
                        20
                )
        );
        inputPanel.add(
                new JLabel("Enzyme Type:")
        );

        enzymeField
                = new JTextField();

        inputPanel.add(
                enzymeField
        );

        inputPanel.add(
                new JLabel("Data File:")
        );

        JPanel filePanel
                = new JPanel(
                        new BorderLayout()
                );

        fileField
                = new JTextField();

        JButton browseButton
                = new JButton("Browse");

        filePanel.add(
                fileField,
                BorderLayout.CENTER
        );

        filePanel.add(
                browseButton,
                BorderLayout.EAST
        );

        inputPanel.add(
                filePanel
        );
        inputPanel.add(
                new JLabel(
                        "Growth / Activity Column:"
                )
        );

        targetCombo
                = new JComboBox<>();

        inputPanel.add(
                targetCombo
        );

        JButton loadButton
                = new JButton("Load Data");

        inputPanel.add(
                loadButton
        );

        JButton runButton
                = new JButton(
                        "Run ML + RSM Optimization"
                );

        inputPanel.add(
                runButton
        );

        mainPanel.add(
                inputPanel,
                BorderLayout.NORTH
        );

        resultArea
                = new JTextArea();

        resultArea.setFont(
                new Font(
                        "Consolas",
                        Font.PLAIN,
                        14
                )
        );

        resultArea.setEditable(false);

        resultArea.setLineWrap(false);

        JScrollPane scrollPane
                = new JScrollPane(
                        resultArea
                );

        mainPanel.add(
                scrollPane,
                BorderLayout.CENTER
        );

        add(mainPanel);
        browseButton.addActionListener(
                e -> browseFile()
        );

        loadButton.addActionListener(
                e -> loadData()
        );

        runButton.addActionListener(
                e -> runOptimization()
        );
    }


    private void browseFile() {

        JFileChooser chooser
                = new JFileChooser();

        chooser.setDialogTitle(
                "Select Enzyme Dataset"
        );

        chooser.setFileFilter(
                new javax.swing.filechooser.FileNameExtensionFilter(
                        "Excel and CSV Files "
                        + "(*.xlsx, *.xls, *.csv)",
                        "xlsx",
                        "xls",
                        "csv"
                )
        );

        int result
                = chooser.showOpenDialog(this);

        if (result
                == JFileChooser.APPROVE_OPTION) {

            File file
                    = chooser.getSelectedFile();

            fileField.setText(
                    file.getAbsolutePath()
            );
        }
    }

    private void loadData() {

        try {

            String filePath
                    = fileField
                            .getText()
                            .trim();

            if (filePath.isEmpty()) {

                JOptionPane.showMessageDialog(
                        this,
                        "Please select an Excel or CSV file."
                );

                return;
            }

            rawData
                    = ExcelReader.readFile(
                            filePath
                    );

            if (rawData == null
                    || rawData.isEmpty()) {

                throw new IllegalArgumentException(
                        "The selected file contains no data."
                );
            }

            targetCombo.removeAllItems();

            for (String column
                    : rawData.get(0).keySet()) {

                targetCombo.addItem(
                        column
                );
            }

            for (int i = 0;
                    i < targetCombo.getItemCount();
                    i++) {

                String column
                        = targetCombo.getItemAt(i);

                String lower
                        = column.toLowerCase();

                if (lower.contains("observed")
                        && (lower.contains("activity")
                        || lower.contains("growth")
                        || lower.contains("yield"))) {

                    targetCombo.setSelectedIndex(i);
                    break;
                }
            }

            String extension
                    = "DATA";

            int dot
                    = filePath.lastIndexOf('.');

            if (dot >= 0) {

                extension
                        = filePath
                                .substring(dot + 1)
                                .toUpperCase();
            }

            resultArea.setText(
                    extension
                    + " FILE LOADED SUCCESSFULLY\n\n"
            );

            resultArea.append(
                    "Rows: "
                    + rawData.size()
                    + "\n\n"
            );

            resultArea.append(
                    "Columns:\n"
            );

            for (String column
                    : rawData.get(0).keySet()) {

                resultArea.append(
                        "  • "
                        + column
                        + "\n"
                );
            }

            resultArea.append(
                    "\nTarget column selected:\n"
            );

            resultArea.append(
                    "  "
                    + targetCombo.getSelectedItem()
                    + "\n\n"
            );

            resultArea.append(
                    "For CCD/RSM data, use the observed "
                    + "activity/growth column as the target.\n"
            );

        } catch (Exception e) {

            e.printStackTrace();

            JOptionPane.showMessageDialog(
                    this,
                    "Error reading data file:\n\n"
                    + e.getMessage(),
                    "File Error",
                    JOptionPane.ERROR_MESSAGE
            );
        }
    }

    private void runOptimization() {

        try {

            if (rawData == null
                    || rawData.isEmpty()) {

                JOptionPane.showMessageDialog(
                        this,
                        "Please load an Excel or CSV file first."
                );

                return;
            }

            String enzyme
                    = enzymeField
                            .getText()
                            .trim();

            String target
                    = (String) targetCombo
                            .getSelectedItem();

            if (enzyme.isEmpty()) {

                JOptionPane.showMessageDialog(
                        this,
                        "Enter enzyme type."
                );

                return;
            }

            if (target == null
                    || target.trim().isEmpty()) {

                JOptionPane.showMessageDialog(
                        this,
                        "Select target column."
                );

                return;
            }


            resultArea.setText(
                    "PROCESSING DATASET...\n\n"
            );

            Instances dataset
                    = DatasetProcessor.convertToWeka(
                            rawData,
                            target
                    );

            DatasetAnalyzer.AnalysisResult analysis
                    = DatasetAnalyzer.analyze(dataset);

            ExperimentalDesignDetector.DesignResult design
                    = ExperimentalDesignDetector.detect(dataset);

            ModelStrategy.StrategyResult strategy
                    = ModelStrategy.determine(analysis, design);
            resultArea.append(
                    "\nAUTOMATIC DATASET ANALYSIS\n"
            );

            resultArea.append(
                    "============================\n"
            );

            resultArea.append(
                    "Number of experiments: "
                    + analysis.getRows()
                    + "\n"
            );

            resultArea.append(
                    "Number of process parameters: "
                    + analysis.getParameterCount()
                    + "\n"
            );

            resultArea.append(
                    "Target response: "
                    + analysis.getTargetColumn()
                    + "\n\n"
            );

            resultArea.append("\nADAPTIVE MODEL STRATEGY\n");
            resultArea.append("============================\n");

            resultArea.append("Recommended model families:\n");

            for (String model : strategy.getRecommendedModels()) {
                resultArea.append("  • " + model + "\n");
            }

            resultArea.append("\nStrategy reasoning:\n");
            resultArea.append(strategy.getReason() + "\n\n");

            resultArea.append("\nEXPERIMENTAL DESIGN ANALYSIS\n");
            resultArea.append("============================\n");

            resultArea.append(
                    "Detected design: "
                    + design.getDesignName()
                    + "\n"
            );

            resultArea.append(
                    "Confidence: "
                    + design.getConfidence()
                    + "\n"
            );

            resultArea.append(
                    "Numeric factors analyzed: "
                    + design.getFactorCount()
                    + "\n"
            );

            if (!analysis.getCategoricalParameters().isEmpty()) {
                resultArea.append(
                        "Categorical parameters: "
                        + analysis.getCategoricalParameters().size()
                        + "\n"
                );
            }

            resultArea.append(
                    "Number of experiments: "
                    + design.getRunCount()
                    + "\n\n"
            );

            resultArea.append("FACTOR STRUCTURE\n");
            resultArea.append("-----------------\n");

            for (ExperimentalDesignDetector.FactorInfo factor
                    : design.getFactorInfo()) {

                resultArea.append(
                        "  " + factor.getParameter()
                        + "\n"
                        + "    Unique levels: "
                        + factor.getLevelCount()
                        + "\n"
                        + "    Center: "
                        + String.format("%.4f", factor.getCenter())
                        + "\n"
                        + "    Center present: "
                        + factor.isCenterPresent()
                        + "\n"
                        + "    Axial pattern: "
                        + factor.hasAxialPattern()
                        + "\n"
                );
            }

            resultArea.append("\nRSM SUITABILITY\n");
            resultArea.append("----------------\n");

            resultArea.append(
                    "Quadratic RSM applicable: "
                    + design.isRsmApplicable()
                    + "\n"
            );

            resultArea.append(
                    design.getExplanation()
                    + "\n\n"
            );

            resultArea.append(
                    "NUMERIC PARAMETERS\n"
            );

            resultArea.append(
                    "------------------\n"
            );

            if (analysis.getNumericParameters().isEmpty()) {

                resultArea.append(
                        "None detected.\n"
                );

            } else {

                for (String parameter
                        : analysis.getNumericParameters()) {

                    resultArea.append(
                            "  • " + parameter + "\n"
                    );
                }
            }

            if (analysis.hasCategoricalParameters()) {

                resultArea.append(
                        "\nCATEGORICAL PARAMETERS\n"
                );

                resultArea.append(
                        "-----------------------\n"
                );

                for (String parameter
                        : analysis.getCategoricalParameters()) {

                    resultArea.append(
                            "  • " + parameter + "\n"
                    );
                }
            }

            resultArea.append(
                    "\nDATASET CHARACTERISTICS\n"
            );

            resultArea.append(
                    "------------------------\n"
            );

            resultArea.append(
                    "Only numeric parameters: "
                    + analysis.hasOnlyNumericParameters()
                    + "\n"
            );

            resultArea.append(
                    "Exactly 3 numeric parameters: "
                    + analysis.hasThreeNumericParameters()
                    + "\n\n"
            );

            resultArea.append(
                    "DATASET INFORMATION\n"
            );

            resultArea.append(
                    "=========================\n"
            );

            resultArea.append(
                    "Enzyme: "
                    + enzyme
                    + "\n"
            );

            resultArea.append(
                    "Rows: "
                    + dataset.numInstances()
                    + "\n"
            );

            resultArea.append(
                    "Input Parameters: "
                    + (dataset.numAttributes() - 1)
                    + "\n"
            );

            resultArea.append(
                    "Target: "
                    + target
                    + "\n\n"
            );

            resultArea.append(
                    "Input parameters used:\n"
            );

            int classIndex
                    = dataset.classIndex();

            for (int i = 0;
                    i < dataset.numAttributes();
                    i++) {

                if (i == classIndex) {
                    continue;
                }

                resultArea.append(
                        "  • "
                        + dataset
                                .attribute(i)
                                .name()
                        + "\n"
                );
            }

            if (!design.isRsmApplicable()) {

                resultArea.append(
                        "\nRSM NOTE:\n"
                );

                resultArea.append(
                        "The detected experimental design is not "
                        + "currently suitable for the available "
                        + "quadratic RSM implementation.\n"
                );

                resultArea.append(
                        "RSM modeling and RSM optimization will be skipped.\n\n"
                );
            }


            List<ModelResult> results
                    = ModelTrainer.trainModels(
                            dataset,
                            design,
                            strategy);

            resultArea.append(
                    "\nMODEL PERFORMANCE\n"
            );

            resultArea.append(
                    "=========================\n"
            );

            for (ModelResult result
                    : results) {

                resultArea.append(
                        String.format(
                                "%s%n"
                                + "R²: %.4f%n"
                                + "RMSE: %.4f%n"
                                + "MAE: %.4f%n%n",
                                result.getModelName(),
                                result.getR2(),
                                result.getRmse(),
                                result.getMae()
                        )
                );
            }

   
            ModelResult bestML
                    = ModelTrainer.selectBestMLModel(
                            results
                    );

            ModelResult rsmResult
                    = ModelTrainer.getRSMResult(
                            results
                    );


            if (bestML != null) {

                resultArea.append(
                        "\nBEST MACHINE-LEARNING MODEL\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                resultArea.append(
                        bestML.getModelName()
                        + "\n"
                );

                resultArea.append(
                        String.format(
                                "R² = %.4f%n",
                                bestML.getR2()
                        )
                );

                resultArea.append(
                        String.format(
                                "RMSE = %.4f%n",
                                bestML.getRmse()
                        )
                );

                resultArea.append(
                        String.format(
                                "MAE = %.4f%n%n",
                                bestML.getMae()
                        )
                );
            }

            if (rsmResult != null) {

                resultArea.append(
                        "RSM QUADRATIC MODEL\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                resultArea.append(
                        String.format(
                                "R² = %.4f%n",
                                rsmResult.getR2()
                        )
                );

                resultArea.append(
                        String.format(
                                "RMSE = %.4f%n",
                                rsmResult.getRmse()
                        )
                );

                resultArea.append(
                        String.format(
                                "MAE = %.4f%n%n",
                                rsmResult.getMae()
                        )
                );
            }

        
            if (bestML != null) {

                resultArea.append(
                        "ML OPTIMIZATION\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                resultArea.append(
                        "Searching for candidate "
                        + "ML optimum...\n\n"
                );

                ParameterOptimizer.OptimizationResult mlOptimization
                        = ParameterOptimizer.optimize(
                                bestML.getModel(),
                                dataset,
                                5000
                        );

                resultArea.append(
                        "ML CANDIDATE OPTIMUM\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                displayOptimization(
                        dataset,
                        mlOptimization
                );

                resultArea.append(
                        "\n ML PREDICTED CANDIDATE MAXIMUM\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                resultArea.append(
                        String.format(
                                "%.4f U/ml%n%n",
                                mlOptimization.predictedGrowth
                        )
                );
            }


            if (rsmResult != null) {

                resultArea.append(
                        "RSM OPTIMIZATION\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                resultArea.append(
                        "Searching for candidate "
                        + "RSM optimum...\n\n"
                );

                ParameterOptimizer.OptimizationResult rsmOptimization
                        = ParameterOptimizer.optimize(
                                rsmResult.getModel(),
                                dataset,
                                5000
                        );

                resultArea.append(
                        "RSM CANDIDATE OPTIMUM\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                displayOptimization(
                        dataset,
                        rsmOptimization
                );

                resultArea.append(
                        "\nRSM PREDICTED MAXIMUM "
                        + "ENZYME ACTIVITY\n"
                );

                resultArea.append(
                        "=========================\n"
                );

                resultArea.append(
                        String.format(
                                "%.4f U/ml%n%n",
                                rsmOptimization.predictedGrowth
                        )
                );
            }

            resultArea.append(
                    "INTERPRETATION\n"
            );

            resultArea.append(
                    "=========================\n"
            );

            resultArea.append(
                    "Laboratory experimentation is required to validate the predicted "
                    + "optimum before treating it as a confirmed production condition.\n"
            );

            resultArea.append(
                    "Cross-validation performance should be interpreted "
                    + "in the context of dataset size and experimental design. "
                    + "Small datasets may produce unstable performance estimates.\n\n"
            );

        } catch (Exception e) {

            e.printStackTrace();

            JOptionPane.showMessageDialog(
                    this,
                    "Processing error:\n\n"
                    + e.getMessage(),
                    "Processing Error",
                    JOptionPane.ERROR_MESSAGE
            );
        }
    }


    private void displayOptimization(
            Instances dataset,
            ParameterOptimizer.OptimizationResult optimization) {

        int classIndex
                = dataset.classIndex();

        for (int i = 0;
                i < dataset.numAttributes();
                i++) {

            if (i == classIndex) {
                continue;
            }

            Attribute attribute
                    = dataset.attribute(i);

            double value
                    = optimization.parameters[i];

            if (attribute.isNumeric()) {

                resultArea.append(
                        String.format(
                                "%s = %.4f%n",
                                attribute.name(),
                                value
                        )
                );

            } else if (attribute.isNominal()) {

                int index
                        = (int) value;

                if (index >= 0
                        && index < attribute.numValues()) {

                    resultArea.append(
                            attribute.name()
                            + " = "
                            + attribute.value(index)
                            + "\n"
                    );
                }
            }
        }
    }
}
