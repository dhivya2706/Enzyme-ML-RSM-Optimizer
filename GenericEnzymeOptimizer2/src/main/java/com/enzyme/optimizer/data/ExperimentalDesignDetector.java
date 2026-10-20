package com.enzyme.optimizer.data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import weka.core.Instances;

public class ExperimentalDesignDetector {

    private static final double TOLERANCE = 1e-6;

    public static DesignResult detect(Instances dataset) {

        if (dataset == null || dataset.numInstances() == 0) {
            throw new IllegalArgumentException("Dataset is empty.");
        }


        List<String> numericParameters = new ArrayList<>();

        for (int i = 0; i < dataset.numAttributes(); i++) {

            if (i == dataset.classIndex()) {
                continue;
            }

            if (dataset.attribute(i).isNumeric()) {
                numericParameters.add(dataset.attribute(i).name());
            }
        }

        int factors = numericParameters.size();
        int runs = dataset.numInstances();

        boolean hasCategoricalParameters =
                hasCategoricalParameters(dataset);

        

        if (factors == 0) {

            String explanation;

            if (hasCategoricalParameters) {
                explanation =
                        "No numeric process parameters were detected. "
                      + "The dataset contains categorical parameters, "
                      + "which can be handled by the machine-learning "
                      + "pipeline but are not used for numeric experimental-"
                      + "design detection.";
            } else {
                explanation =
                        "No numeric process parameters were detected.";
            }

            return new DesignResult(
                    "No numeric experimental factors",
                    "Low",
                    factors,
                    runs,
                    false,
                    explanation,
                    new ArrayList<>()
            );
        }

      

        List<FactorInfo> factorInfo = new ArrayList<>();

        for (String parameter : numericParameters) {

            int index =
                    dataset.attribute(parameter).index();

            List<Double> values = new ArrayList<>();

            for (int r = 0; r < runs; r++) {

                double value =
                        dataset.instance(r).value(index);

                if (!Double.isNaN(value)) {
                    values.add(value);
                }
            }

            Collections.sort(values);

            List<Double> uniqueValues =
                    getUniqueValues(values);

            double center =
                    calculateCenter(uniqueValues);

            boolean centerPresent =
                    containsApproximately(
                            uniqueValues,
                            center);

            boolean axialPattern =
                    detectAxialPattern(
                            uniqueValues,
                            center);

            factorInfo.add(
                    new FactorInfo(
                            parameter,
                            uniqueValues.size(),
                            center,
                            centerPresent,
                            axialPattern
                    )
            );
        }

       

        boolean ccd =
                detectCCD(
                        dataset,
                        numericParameters,
                        factorInfo
                );

        if (ccd) {

            String explanation =
                    "The observed factor combinations contain "
                  + "center, factorial/corner, and axial-style "
                  + "points consistent with a central composite "
                  + "response-surface design.";

            if (hasCategoricalParameters) {
                explanation +=
                        " Categorical parameters are excluded "
                      + "from the numeric CCD detection.";
            }

            return new DesignResult(
                    "Central Composite Design (CCD)",
                    "High",
                    factors,
                    runs,
                    true,
                    explanation,
                    factorInfo
            );
        }

        boolean boxBehnken =
                detectBoxBehnken(
                        dataset,
                        numericParameters,
                        factorInfo
                );

        if (boxBehnken) {

            String explanation =
                    "The observed factor combinations contain "
                  + "center observations and combinations where "
                  + "two factors vary while the remaining factor "
                  + "is near its center, consistent with a "
                  + "Box-Behnken-like structure.";

            if (hasCategoricalParameters) {
                explanation +=
                        " Categorical parameters are excluded "
                      + "from the numeric Box-Behnken detection.";
            }

            return new DesignResult(
                    "Box-Behnken-like",
                    "Medium",
                    factors,
                    runs,
                    false,
                    explanation,
                    factorInfo
            );
        }

        boolean factorial =
                detectFactorial(
                        dataset,
                        numericParameters,
                        factorInfo
                );

        if (factorial) {

            String explanation =
                    "The dataset contains repeated combinations "
                  + "of numeric factor levels consistent with a "
                  + "structured factorial experimental design.";

            if (hasCategoricalParameters) {
                explanation +=
                        " Categorical parameters are excluded "
                      + "from the numeric factorial detection.";
            }

            return new DesignResult(
                    "Factorial-like design",
                    "Medium",
                    factors,
                    runs,
                    false,
                    explanation,
                    factorInfo
            );
        }

        boolean screening =
                detectScreening(
                        dataset,
                        numericParameters,
                        factorInfo
                );

        if (screening) {

            String explanation =
                    "The dataset has a relatively small number "
                  + "of runs compared with the number of numeric "
                  + "factors and predominantly two-level numeric "
                  + "factors. The structure is consistent with a "
                  + "possible screening design.";

            if (hasCategoricalParameters) {
                explanation +=
                        " Categorical parameters are excluded "
                      + "from the numeric screening detection.";
            }

            return new DesignResult(
                    "Screening / Plackett-Burman-like",
                    "Low",
                    factors,
                    runs,
                    false,
                    explanation,
                    factorInfo
            );
        }

        boolean ofat =
                detectOFAT(
                        dataset,
                        numericParameters
                );

        if (ofat) {

            String explanation;

            if (hasCategoricalParameters) {

                explanation =
                        "The numeric experimental factors appear "
                      + "to vary one factor at a time while other "
                      + "numeric factors remain approximately fixed. "
                      + "Categorical parameters are analyzed separately.";

            } else {

                explanation =
                        "The experimental runs appear to vary one "
                      + "factor at a time while other factors remain "
                      + "approximately fixed.";
            }

            return new DesignResult(
                    "OFAT-like",
                    "Medium",
                    factors,
                    runs,
                    false,
                    explanation,
                    factorInfo
            );
        }


        String explanation;

        if (hasCategoricalParameters) {

            explanation =
                    "The observed numeric factor combinations do not "
                  + "provide sufficient evidence for the currently "
                  + "supported experimental-design structures. "
                  + "Categorical parameters are analyzed separately "
                  + "by the machine-learning pipeline.";

        } else {

            explanation =
                    "The observed factor combinations do not provide "
                  + "sufficient evidence for the currently supported "
                  + "experimental-design structures.";
        }

        return new DesignResult(
                "Unknown / observational design",
                "Low",
                factors,
                runs,
                false,
                explanation,
                factorInfo
        );
}

    private static boolean hasCategoricalParameters(
            Instances dataset) {

        for (int i = 0;
             i < dataset.numAttributes();
             i++) {

            if (i == dataset.classIndex()) {
                continue;
            }

            if (dataset.attribute(i).isNominal()) {
                return true;
            }
        }

        return false;
    }


    private static boolean detectCCD(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        int k = factors.size();

        if (k < 2 || k > 5) {
            return false;
        }

        if (dataset.numInstances() < 10) {
            return false;
        }

 

        for (FactorInfo f : info) {

            if (f.getLevelCount() < 5) {
                return false;
            }

            if (!f.isCenterPresent()) {
                return false;
            }

            if (!f.hasAxialPattern()) {
                return false;
            }
        }


        int centerRuns =
                countCenterRuns(
                        dataset,
                        factors,
                        info
                );

        int axialRuns =
                countAxialRuns(
                        dataset,
                        factors,
                        info
                );

        int cornerRuns =
                countCornerRuns(
                        dataset,
                        factors,
                        info
                );

     

        return centerRuns >= 1
                && axialRuns >= 2 * k
                && cornerRuns >= Math.max(
                        4,
                        1 << Math.min(k, 4)
                );
        }

    private static boolean detectBoxBehnken(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        int k = factors.size();


        if (k < 3) {
            return false;
        }


        if (dataset.numInstances() < 12) {
            return false;
        }

      

        for (FactorInfo f : info) {

            if (f.getLevelCount() != 3) {
                return false;
            }

            if (!f.isCenterPresent()) {
                return false;
            }
        }


        int centerRuns =
                countCenterRuns(
                        dataset,
                        factors,
                        info
                );

        if (centerRuns < 1) {
            return false;
        }

       

        int pairRuns = 0;

        Set<String> factorPairs =
                new HashSet<>();

        for (int r = 0;
             r < dataset.numInstances();
             r++) {

            List<Integer> nonCenterFactors =
                    new ArrayList<>();

            for (int f = 0;
                 f < factors.size();
                 f++) {

                String name =
                        factors.get(f);

                double value =
                        dataset.instance(r)
                                .value(
                                        dataset.attribute(name)
                                                .index()
                                );

                double center =
                        info.get(f).getCenter();

                if (Math.abs(value - center)
                        > TOLERANCE) {

                    nonCenterFactors.add(f);
                }
            }

          

            if (nonCenterFactors.size() == 2) {

                pairRuns++;

                int a =
                        nonCenterFactors.get(0);

                int b =
                        nonCenterFactors.get(1);

                
                String pair =
                        Math.min(a, b)
                        + "-"
                        + Math.max(a, b);

                factorPairs.add(pair);
            }
        }

     
        int expectedPairs =
                k * (k - 1) / 2;

       

        return pairRuns >= expectedPairs * 2
                && factorPairs.size() >= expectedPairs;
    }


    private static boolean detectFactorial(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        int k = factors.size();

        if (k < 2) {
            return false;
        }

       

        int twoLevelFactors = 0;

        for (FactorInfo f : info) {

            if (f.getLevelCount() == 2) {
                twoLevelFactors++;
            }
        }

        if (twoLevelFactors < k) {
            return false;
        }

        long expected =
                1L << Math.min(k, 20);

        if (dataset.numInstances() < 4) {
            return false;
        }

        

        Set<String> combinations =
                getUniqueCombinations(
                        dataset,
                        factors
                );

        int uniqueRuns =
                combinations.size();

        

        if (expected <= 1024
                && uniqueRuns == expected) {

            return true;
        }

        

        return uniqueRuns >=
                Math.max(
                        4,
                        expected / 2
                );
    }

   

    private static boolean detectScreening(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        if (factors.size() < 3) {
            return false;
        }

        int twoLevelFactors = 0;

        for (FactorInfo f : info) {

            if (f.getLevelCount() == 2) {
                twoLevelFactors++;
            }
        }

        if (twoLevelFactors
                < factors.size() * 0.8) {

            return false;
        }

        long fullFactorial =
                1L << Math.min(
                        factors.size(),
                        20
                );

        return dataset.numInstances()
                < fullFactorial;
    }

    

    private static boolean detectOFAT(
            Instances dataset,
            List<String> factors) {

        if (factors.size() < 2) {
            return false;
        }

        int ofatTransitions = 0;

        for (int r = 1;
             r < dataset.numInstances();
             r++) {

            int changed = 0;

            for (String factor : factors) {

                int index =
                        dataset.attribute(factor).index();

                double previous =
                        dataset.instance(r - 1)
                                .value(index);

                double current =
                        dataset.instance(r)
                                .value(index);

                if (Math.abs(current - previous)
                        > TOLERANCE) {

                    changed++;
                }
            }

            if (changed == 1) {
                ofatTransitions++;
            }
        }

        

        int transitions =
                Math.max(
                        1,
                        dataset.numInstances() - 1
                );

        return ((double) ofatTransitions
                / transitions) >= 0.60;
    }

    

    private static int countCenterRuns(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        int count = 0;

        for (int r = 0;
             r < dataset.numInstances();
             r++) {

            boolean center = true;

            for (int f = 0;
                 f < factors.size();
                 f++) {

                String name =
                        factors.get(f);

                double value =
                        dataset.instance(r)
                                .value(
                                        dataset.attribute(name)
                                                .index()
                                );

                double factorCenter =
                        info.get(f).getCenter();

                if (Math.abs(
                        value - factorCenter)
                        > TOLERANCE) {

                    center = false;
                    break;
                }
            }

            if (center) {
                count++;
            }
        }

        return count;
    }

    private static int countAxialRuns(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        int count = 0;

        for (int r = 0;
             r < dataset.numInstances();
             r++) {

            int nonCenter = 0;

            for (int f = 0;
                 f < factors.size();
                 f++) {

                String name =
                        factors.get(f);

                double value =
                        dataset.instance(r)
                                .value(
                                        dataset.attribute(name)
                                                .index()
                                );

                double center =
                        info.get(f).getCenter();

                if (Math.abs(value - center)
                        > TOLERANCE) {

                    nonCenter++;
                }
            }

           

            if (nonCenter == 1) {
                count++;
            }
        }

        return count;
    }

    private static int countCornerRuns(
            Instances dataset,
            List<String> factors,
            List<FactorInfo> info) {

        int count = 0;

        for (int r = 0;
             r < dataset.numInstances();
             r++) {

            int nonCenter = 0;

            for (int f = 0;
                 f < factors.size();
                 f++) {

                String name =
                        factors.get(f);

                double value =
                        dataset.instance(r)
                                .value(
                                        dataset.attribute(name)
                                                .index()
                                );

                double center =
                        info.get(f).getCenter();

                if (Math.abs(value - center)
                        > TOLERANCE) {

                    nonCenter++;
                }
            }


            if (nonCenter == factors.size()) {
                count++;
            }
        }

        return count;
    }

    private static Set<String> getUniqueCombinations(
            Instances dataset,
            List<String> factors) {

        Set<String> combinations =
                new HashSet<>();

        for (int r = 0;
             r < dataset.numInstances();
             r++) {

            StringBuilder key =
                    new StringBuilder();

            for (String factor : factors) {

                int index =
                        dataset.attribute(factor).index();

                double value =
                        dataset.instance(r)
                                .value(index);

                key.append(
                        round(value)
                ).append("|");
            }

            combinations.add(
                    key.toString()
            );
        }

        return combinations;
    }

  

    private static List<Double> getUniqueValues(
            List<Double> sortedValues) {

        List<Double> unique =
                new ArrayList<>();

        for (double value : sortedValues) {

            if (unique.isEmpty()
                    || Math.abs(
                            value
                            - unique.get(
                                    unique.size() - 1)
                    ) > TOLERANCE) {

                unique.add(value);
            }
        }

        return unique;
    }

    private static double calculateCenter(
            List<Double> levels) {

        if (levels.isEmpty()) {
            return Double.NaN;
        }

        List<Double> sorted =
                new ArrayList<>(levels);

        Collections.sort(sorted);

      
        return sorted.get(
                sorted.size() / 2
        );
    }

    private static boolean containsApproximately(
            List<Double> values,
            double target) {

        for (double value : values) {

            if (Math.abs(value - target)
                    <= TOLERANCE) {

                return true;
            }
        }

        return false;
    }

    private static boolean detectAxialPattern(
            List<Double> levels,
            double center) {

        if (levels.size() < 5) {
            return false;
        }

        List<Double> distances =
                new ArrayList<>();

        for (double level : levels) {

            double distance =
                    Math.abs(level - center);

            if (distance > TOLERANCE) {
                distances.add(distance);
            }
        }

        if (distances.size() < 4) {
            return false;
        }

        Collections.sort(distances);

        
        double smallest =
                distances.get(0);

        double largest =
                distances.get(
                        distances.size() - 1
                );

        return largest > smallest * 1.20;
    }

    private static double round(double value) {

        return Math.round(
                value * 1_000_000.0
        ) / 1_000_000.0;
    }


    public static class DesignResult {

        private final String designName;
        private final String confidence;
        private final int factorCount;
        private final int runCount;
        private final boolean rsmApplicable;
        private final String explanation;
        private final List<FactorInfo> factorInfo;

        public DesignResult(
                String designName,
                String confidence,
                int factorCount,
                int runCount,
                boolean rsmApplicable,
                String explanation) {

            this(
                    designName,
                    confidence,
                    factorCount,
                    runCount,
                    rsmApplicable,
                    explanation,
                    new ArrayList<>()
            );
        }

        public DesignResult(
                String designName,
                String confidence,
                int factorCount,
                int runCount,
                boolean rsmApplicable,
                String explanation,
                List<FactorInfo> factorInfo) {

            this.designName = designName;
            this.confidence = confidence;
            this.factorCount = factorCount;
            this.runCount = runCount;
            this.rsmApplicable = rsmApplicable;
            this.explanation = explanation;
            this.factorInfo = factorInfo;
        }

        public String getDesignName() {
            return designName;
        }

        public String getConfidence() {
            return confidence;
        }

        public int getFactorCount() {
            return factorCount;
        }

        public int getRunCount() {
            return runCount;
        }

        public boolean isRsmApplicable() {
            return rsmApplicable;
        }

        public String getExplanation() {
            return explanation;
        }

        public List<FactorInfo> getFactorInfo() {
            return factorInfo;
        }
    }

   

    public static class FactorInfo {

        private final String parameter;
        private final int levelCount;
        private final double center;
        private final boolean centerPresent;
        private final boolean axialPattern;

        public FactorInfo(
                String parameter,
                int levelCount,
                double center,
                boolean centerPresent,
                boolean axialPattern) {

            this.parameter = parameter;
            this.levelCount = levelCount;
            this.center = center;
            this.centerPresent = centerPresent;
            this.axialPattern = axialPattern;
        }

        public String getParameter() {
            return parameter;
        }

        public int getLevelCount() {
            return levelCount;
        }

        public double getCenter() {
            return center;
        }

        public boolean isCenterPresent() {
            return centerPresent;
        }

        public boolean hasAxialPattern() {
            return axialPattern;
        }
    }
}