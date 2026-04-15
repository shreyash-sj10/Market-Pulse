const path = require('path');
const yahooProvider = require('./backend/src/services/news/news.provider.yahoo');
const classificationEngine = require('./backend/src/services/news/classification.engine');

async function audit() {
  console.log("--- STEP 1: INPUT DATA VALIDATION ---");
  try {
    const rawNews = await yahooProvider.getNews('NIFTY');
    console.log(`Fetched ${rawNews.length} articles from Yahoo Finance.`);
    
    if (rawNews.length === 0) {
      console.log("FAIL: Empty raw news array.");
    } else {
      const first = rawNews[0];
      // console.log("First article structure:", JSON.stringify(first, null, 2));
      const hasFields = first.headline && first.url && first.timestamp;
      console.log(`Fields valid: ${!!hasFields}`);
    }

    console.log("\n--- STEP 2 & 3: CLASSIFICATION & RELEVANCE DEBUG ---");
    const auditResults = rawNews.map(item => {
      const text = `${item.headline} ${item.summary || ""}`;
      const country = classificationEngine.detectCountry(text);
      const relevance = classificationEngine.getRelevance('NIFTY', text, {});
      const sector = classificationEngine.mapSector(text);
      return { title: item.headline, country, relevance, sector };
    });

    const noneCount = auditResults.filter(r => r.relevance === "NONE").length;
    const directCount = auditResults.filter(r => r.relevance === "DIRECT").length;
    const indirectCount = auditResults.filter(r => r.relevance === "INDIRECT").length;
    const macroCount = auditResults.filter(r => r.relevance === "MACRO").length;

    console.log(`Counts: RAW=${rawNews.length}, NONE=${noneCount}, DIRECT=${directCount}, INDIRECT=${indirectCount}, MACRO=${macroCount}`);
    
    if (rawNews.length > 0) {
       console.log("Sample classifications:");
       auditResults.slice(0, 5).forEach(r => console.log(`- [${r.relevance}] ${r.title}`));
    }

    console.log("\n--- STEP 3: RELEVANCE ENGINE TEST CASES ---");
    const testCases = [
      "RBI repo rate",
      "Crude oil falls",
      "Federal Reserve meeting outcome",
      "TCS wins large multi-year contract"
    ];
    testCases.forEach(text => {
      const rel = classificationEngine.getRelevance('NIFTY', text, {});
      const sec = classificationEngine.mapSector(text);
      console.log(`Input: "${text}" -> Relevance: ${rel}, Sector: ${sec}`);
    });

    console.log("\n--- STEP 4: SIGNAL GENERATION CHECK ---");
    const item = rawNews[0];
    if (item) {
        const text = `${item.headline} ${item.summary || ""}`;
        const relevance = classificationEngine.getRelevance('NIFTY', text, {});
        const country = classificationEngine.detectCountry(text);
        const signal = classificationEngine.generateSignal(item.headline, item.summary || "", relevance, country);
        console.log("Signal Sample:", JSON.stringify(signal, null, 2));
    }

  } catch (err) {
    console.error("Audit script failed:", err);
  }
}

audit();
