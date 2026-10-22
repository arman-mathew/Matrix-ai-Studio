// src/aiService.ts

export async function askSpreadsheetAI(userPrompt: string, sheetContext: { activeCell: string; columns: string }) {
  // Vite exposes env variables via import.meta.env
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key is missing! Check your .env file.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `
    You are an expert spreadsheet formula assistant.
    Sheet Context:
    - Active Cell: ${sheetContext.activeCell}
    - Available Columns: ${sheetContext.columns}

    Rules:
    1. Output ONLY a valid Excel formula or direct answer.
    2. Do NOT include markdown code blocks or conversational text.
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemInstruction },
            { text: `User Request: ${userPrompt}` }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  return rawOutput.replace(/```excel|```/g, "").trim();
}