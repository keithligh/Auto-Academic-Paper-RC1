/**
 * Test: Logic of JSON.parse on unwrapped keys
 * Run with: npx tsx test_json_error.ts
 */

const inputs = [
    '"found": false',
    '"found": true, "reference": {}',
    'Just some text',
    '{"found": true} extra'
];

inputs.forEach(input => {
    console.log(`\nTesting: [${input}]`);
    try {
        JSON.parse(input);
        console.log("✅ Parsed!");
    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    }
});
