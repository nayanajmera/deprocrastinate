const { GoogleGenAI, Type } = require("@google/genai");
// Initialize
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getFallbackSubtasks = (title) => {
  // const t = title.toLowerCase();
  // if (t.includes("buy") || t.includes("shop")) return ["Make a list", "Check budget", "Go to store", "Purchase items"];
  // if (t.includes("clean")) return ["Gather supplies", "Clear clutter", "Wipe surfaces", "Take out trash"];
  // if (t.includes("study") || t.includes("learn")) return ["Review notes", "Read chapter", "Practice problems", "Summarize key points"];
  // if (t.includes("code") || t.includes("app")) return ["Define requirements", "Setup environment", "Write core logic", "Test functionality"];
  // if (t.includes("call") || t.includes("email")) return ["Find contact info", "Draft points", "Make the connection", "Follow up"];
  return ["Plan the first step", "Gather resources", "Execute the main task", "Review work"];
};

exports.generateSubtasks = async (req, res) => {
  const { taskTitle } = req.body;
  
  if (!taskTitle) {
    return res.status(400).json({ message: "Task title is required" });
  }

  try {
    const systemInstruction = `You are an AI of an app called DeProcrastinate. Your task is to break a 'Task' provided to you into subtasks efficiently. You can divide the subtask into a MAXIMUM of 15 subtasks. User's task can be anything related to their daily life. You are not their chatbot, just used for this purpose, so just divide the tasks.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: taskTitle,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "List of actionable subtasks breaking down the given task (maximum 15 subtasks).",
        },
      },
    });

    const rawText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty AI response");

    const jsonText = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(jsonText);

    const subtasks = (Array.isArray(parsed) ? parsed : (parsed?.subtasks || []))
      .map(line => (typeof line === "string" ? line.trim() : ""))
      .filter(line => line.length > 0);

    if (subtasks.length === 0) throw new Error("Empty AI response");

    res.json({ subtasks });

  } catch (err) {
    console.log("API Failed, using Local Backup. Reason:", err.message);
    
    const backupSteps = getFallbackSubtasks(taskTitle);
    res.json({ subtasks: backupSteps });
  }
};
