package com.enzyme.optimizer;

import javax.swing.SwingUtilities;

public class Main {

    public static void main(String[] args) {

        SwingUtilities.invokeLater(() -> {

            EnzymeOptimizerGUI gui =
                    new EnzymeOptimizerGUI();

            gui.setVisible(true);
        });
    }
}