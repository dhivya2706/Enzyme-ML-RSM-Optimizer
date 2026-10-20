
package com.enzyme.optimizer.api;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
            "status", "ok",
            "service", "GenericEnzymeOptimizer2 API",
            "defaultTargetColumn", "ObservedActivity_U_ml"
        );
    }
}
