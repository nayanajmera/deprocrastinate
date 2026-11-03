const { GoogleGenAI } = require("@google/genai");
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
    const prompt =`You are an AI of an app called DeProcrastinate. Your task is to break a 'Task' provided to you into subtasks efficiently. You can divide the subtask into a MAXIMUM of 15 subtasks. User's task can be anything realted to their daily life.
    The output format you have to use is, provide a new line character \n after every subtask. You have to strictly abide this. You are not their chatbot, just used for this purpose, so just divide the tasks.
    USER's Task : ${taskTitle}.`

    const response = await genAI.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ parts: [{ text: prompt }] }]
    });

    const rawText = response.candidates[0].content.parts[0].text;

    const subtasks = rawText
      .split("\n")
      .map(line => line.replace(/^[-*•\d\.]+\s*/, "").trim()) 
      .filter(line => line.length > 2)

    if (subtasks.length === 0) throw new Error("Empty AI response");

    res.json({ subtasks });

  } catch (err) {
    console.log("API Failed, using Local Backup. Reason:", err.message);
    
    const backupSteps = getFallbackSubtasks(taskTitle);
    res.json({ subtasks: backupSteps });
  }
};