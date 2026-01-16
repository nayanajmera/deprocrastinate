const { HfInference } = require('@huggingface/inference');

// Initialize
const hf = new HfInference(process.env.HF_API_KEY);

const getFallbackSubtasks = (title) => {
  const t = title.toLowerCase();
  if (t.includes("buy") || t.includes("shop")) return ["Make a list", "Check budget", "Go to store", "Purchase items"];
  if (t.includes("clean")) return ["Gather supplies", "Clear clutter", "Wipe surfaces", "Take out trash"];
  if (t.includes("study") || t.includes("learn")) return ["Review notes", "Read chapter", "Practice problems", "Summarize key points"];
  if (t.includes("code") || t.includes("app")) return ["Define requirements", "Setup environment", "Write core logic", "Test functionality"];
  if (t.includes("call") || t.includes("email")) return ["Find contact info", "Draft points", "Make the connection", "Follow up"];
  return ["Plan the first step", "Gather resources", "Execute the main task", "Review work"];
};

exports.generateSubtasks = async (req, res) => {
  const { taskTitle } = req.body;
  
  if (!taskTitle) {
    return res.status(400).json({ message: "Task title is required" });
  }

  try {
    const response = await hf.chatCompletion({
      model: "google/gemma-2-2b-it", 
      messages: [
        { 
          role: "user", 
          content: `Break the task "${taskTitle}" into short, actionable subtasks (max 5 words each). Return ONLY the subtasks, one per line. Keep the number of subtasks strictly less than 15.
          Also, try to keep theme minimum.` 
        }
      ],
      max_tokens: 150,
      temperature: 0.5
    });

    const rawText = response.choices[0].message.content;

    const subtasks = rawText
      .split("\n")
      .map(line => line.replace(/^[-*•\d\.]+\s*/, "").trim()) 
      .filter(line => line.length > 2)
      .slice(0, 5);

    if (subtasks.length === 0) throw new Error("Empty AI response");

    res.json({ subtasks });

  } catch (err) {
    console.log("⚠️ API Failed, using Local Backup. Reason:", err.message);
    
    const backupSteps = getFallbackSubtasks(taskTitle);
    res.json({ subtasks: backupSteps });
  }
};