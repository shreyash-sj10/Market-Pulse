const axios = require('axios');

async function auditIntelligence() {
  const API_URL = "http://localhost:5001/api";
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("INTELLIGENCE RUNTIME AUDIT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // 1. REGISTER / LOGIN
    console.log("Step 1: Initializing Terminal Access...");
    let token;
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
          email: "audit@terminal.com",
          password: "AuditPassword123!"
        });
        token = loginRes.data.token;
    } catch (e) {
        console.log("Account missing, registering new node...");
        const regRes = await axios.post(`${API_URL}/auth/register`, {
          name: "Audit Node",
          email: "audit@terminal.com",
          password: "AuditPassword123!"
        });
        token = regRes.data.token;
    }
    
    console.log("✅ Authenticated.");

    const config = { headers: { Authorization: `Bearer ${token}` } };
    const endpoints = ['news', 'portfolio', 'global'];

    for (const ep of endpoints) {
      const start = Date.now();
      const res = await axios.get(`${API_URL}/intelligence/${ep}?symbol=RELIANCE`, config);
      const latency = Date.now() - start;

      console.log(`\nENDPOINT: /intelligence/${ep}`);
      console.log(`STATUS: ${res.status}`);
      console.log(`LATENCY: ${latency}ms`);
      
      const signals = res.data.signals || res.data.data?.signals || [];
      console.log(`FINAL_COUNT: ${signals.length}`);
      
      if (signals.length > 0) {
        const first = signals[0];
        console.log(`SAMPLE_SIGNAL: ${first.title}`);
        console.log(`CONFIDENCE: ${first.confidence}%`);
        console.log(`IMPACT: ${first.impact}`);
        console.log(`CONFLICT: ${first.conflict || false}`);
      } else {
        console.warn("⚠️  WARNING: 0 signals returned (Fallback Engine active?)");
      }
    }
  } catch (err) {
    console.error(`❌ CRITICAL FAILURE: ${err.message}`);
    if (err.response) console.error("Response:", err.response.data);
  }
}

auditIntelligence();
