const yf = require('yahoo-finance2');
console.log('Main:', typeof yf);
console.log('Default:', typeof yf.default);
if (yf.default) {
    try {
        console.log('Default quote:', typeof yf.default.quote);
    } catch (e) {
        console.log('Default error:', e.message);
    }
}
try {
    console.log('Main quote:', typeof yf.quote);
} catch (e) {
    console.log('Main error:', e.message);
}
