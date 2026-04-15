const { toPaise, calculatePct, enforcePaise } = require('../backend/src/utils/paise');

console.log("--- PAISE PROTOCOL VALIDATION ---");

// Test 1: Rupee to Paise Conversion
const rupeeValue = 100.25;
const paiseValue = toPaise(rupeeValue);
console.log(`Rupee: ${rupeeValue} -> Paise: ${paiseValue}`);
if (paiseValue === 10025) {
    console.log("✅ Test 1 Passed: Rupee to Paise conversion is accurate.");
} else {
    console.log("❌ Test 1 Failed: Rupee to Paise conversion drift detected.");
}

// Test 2: Percentage Calculation
const pnl = 100; // ₹1 profit
const invested = 10000; // ₹100 invested
const pct = calculatePct(pnl, invested);
console.log(`PnL: ${pnl} paise, Invested: ${invested} paise -> PnL%: ${pct}%`);
if (pct === 1.00) {
    console.log("✅ Test 2 Passed: 1% PnL displays correctly.");
} else {
    console.log("❌ Test 2 Failed: PnL% calculation incorrect.");
}

// Test 3: Type Enforcement
try {
    console.log("Testing float rejection...");
    enforcePaise(100.5, "testField");
    console.log("❌ Test 3 Failed: Float value accepted.");
} catch (e) {
    console.log(`✅ Test 3 Passed: Float rejected with error: ${e.message}`);
}

// Test 4: Precision Safety
const weirdFloat = 0.1 + 0.2; // 0.30000000000000004
const roundedPaise = toPaise(weirdFloat);
console.log(`Weird Float: ${weirdFloat} -> Rounded Paise: ${roundedPaise}`);
if (roundedPaise === 30) {
    console.log("✅ Test 4 Passed: Precision safety handled.");
} else {
    console.log("❌ Test 4 Failed: Precision drift leaked.");
}

console.log("--- VALIDATION COMPLETE ---");
