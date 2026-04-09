const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
console.log('Instance created');
console.log('Instance quote:', typeof yahooFinance.quote);
yahooFinance.quote('AAPL')
    .then(q => console.log('Successfully fetched AAPL'))
    .catch(e => console.log('Fetch error:', e.message));
