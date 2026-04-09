const marketService = require('./src/services/market.service');
require('dotenv').config();

async function test() {
  try {
    const indices = await marketService.getMarketIndices();
    console.log('INDICES:', JSON.stringify(indices, null, 2));
  } catch (e) {
    console.error(e);
  }
}

test();
