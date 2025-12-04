
import { z } from "zod";
import { documentAnalysisSchema, enhancementSchema, aiResponseSchema } from "../../shared/schema";

// Mock data
const validEnhancement = {
    id: "enh-123",
    type: "formula",
    title: "Einstein's Field Equation",
    description: "The core equation of General Relativity",
    content: "\\begin{equation} G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\kappa T_{\\mu\\nu} \\end{equation}",
    location: "Introduction",
    reasoning: "Fundamental to the paper's topic",
    enabled: true
};

const validAnalysis = {
    title: "General Relativity Overview",
    abstract: "A brief overview of GR.",
    sections: [
        { name: "Introduction", content: "GR is a theory of gravity." },
        { name: "Methods", content: "We used math." }
    ],
    references: [
        { key: "einstein1915", author: "Einstein, A.", title: "Die Feldgleichungen", venue: "Sitzungsberichte", year: 1915 }
    ]
};

const validAiResponse = {
    ...validAnalysis,
    enhancements: [validEnhancement]
};

// Tests
async function runTests() {
    console.log("Running Zod Schema Tests...\n");
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    }

    function assertThrows(fn: () => void, message: string) {
        try {
            fn();
            console.error(`❌ FAIL: ${message} (Did not throw)`);
            failed++;
        } catch (e) {
            console.log(`✅ PASS: ${message} (Threw as expected)`);
            passed++;
        }
    }

    // 1. Test Enhancement Schema
    try {
        enhancementSchema.parse(validEnhancement);
        assert(true, "Valid enhancement should parse");
    } catch (e) {
        assert(false, `Valid enhancement failed to parse: ${e}`);
    }

    const invalidEnhancement = { ...validEnhancement, type: "invalid_type" };
    assertThrows(() => enhancementSchema.parse(invalidEnhancement), "Invalid enhancement type should fail");

    // 2. Test Document Analysis Schema
    try {
        documentAnalysisSchema.parse(validAnalysis);
        assert(true, "Valid analysis should parse");
    } catch (e) {
        assert(false, `Valid analysis failed to parse: ${e}`);
    }

    const invalidAnalysis = { ...validAnalysis, sections: "not an array" };
    assertThrows(() => documentAnalysisSchema.parse(invalidAnalysis), "Invalid sections type should fail");

    // 3. Test AI Response Schema
    try {
        aiResponseSchema.parse(validAiResponse);
        assert(true, "Valid AI response should parse");
    } catch (e) {
        assert(false, `Valid AI response failed to parse: ${e}`);
    }

    const invalidAiResponse = { ...validAnalysis, enhancements: "not an array" };
    assertThrows(() => aiResponseSchema.parse(invalidAiResponse), "Invalid enhancements type in AI response should fail");

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
