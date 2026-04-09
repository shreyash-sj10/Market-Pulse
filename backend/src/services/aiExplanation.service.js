const { GoogleGenerativeAI } = require("@google/generative-ai");

const generateDeterministicExplanation = (riskScore, mistakeTags) => {
  const explanation = (!mistakeTags || mistakeTags.length === 0)
    ? `This trade has an acceptable risk score of ${riskScore}. No critical mistakes were detected.`
    : `This trade carries a risk score of ${riskScore} due to: ${mistakeTags.join(", ")}.`;
  
  return {
    explanation,
    behaviorAnalysis: "Standard trading behavior observed."
  };
};

const generateExplanation = async (riskScore, mistakeTags, context = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    return generateDeterministicExplanation(riskScore, mistakeTags);
  }

  const { symbol, type, reason, userThinking } = context;

  const prompt = `You are a professional trading psychologist and risk analyst.
Context:
- Symbol: ${symbol}
- Trade Type: ${type}
- Risk Score: ${riskScore}/100
- Mistake Tags: ${mistakeTags.length > 0 ? mistakeTags.join(", ") : "None"}
- User's Stated Reason: ${reason || "Not provided"}
- User's Internal Thinking: ${userThinking || "Not provided"}

Produce a JSON response with two fields:
1. "explanation": A concise (2 sentences) explanation of the technical risk.
2. "behaviorAnalysis": A deep, empathetic analysis of the user's psychological state and decision-making logic. Identify if they are being impulsive, disciplined, fearful, or overly optimistic.

Rules:
- Be professional yet humanised.
- Use the User's Thinking to reveal hidden biases.
- Keep the tone constructive.
- Response MUST be valid JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI timeout")), 10000);
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);

    const response = await result.response;
    const data = JSON.parse(response.text());
    
    return {
      explanation: data.explanation,
      behaviorAnalysis: data.behaviorAnalysis
    };
  } catch (error) {
    console.error("[AI Service Error]", error);
    return generateDeterministicExplanation(riskScore, mistakeTags);
  }
};

module.exports = {
  generateExplanation,
};
