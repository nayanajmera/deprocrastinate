const Task = require('../models/Task');
const User = require('../models/User');
const mongoose = require('mongoose');

const calculateXP = (task) => {
  const baseXP = 2;
  let multiplier = 1;
  if (task.priority === 'medium') multiplier = 1.5;
  if (task.priority === 'high') multiplier = 2;
  if (task.priority === 'urgent') multiplier = 2.5;

  const durationBonus = Math.min(40, (task.estimatedHours || 0) * 2);
  return Math.round((baseXP * multiplier) + durationBonus);
};

// 1. get tasks
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id }).sort({ date: -1 });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// 2. create task
exports.createTask = async (req, res) => {
  try {
    if(!req.body) return res.status(400).json({ message: "Request body is missing" });
    const { title, priority, estimatedHours, date } = req.body;

    if (!title || !priority || !estimatedHours || !date) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (typeof title !== 'string' || title.length > 100) {
      return res.status(400).json({ message: "Title too long or invalid" });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (typeof priority !== 'string' || !validPriorities.includes(priority.toLowerCase())) {
      return res.status(400).json({ message: "Invalid priority. Must be low, medium, high, or urgent." });
    }

    const hours = parseFloat(estimatedHours);
    if (isNaN(hours) || hours <= 0 || hours > 24 || (hours * 2) % 1 !== 0) {
      return res.status(400).json({ message: "Estimated hours must be between 0.5 and 24, in 0.5 increments." });
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const newTask = new Task({
      user: req.user.id,
      title,
      priority: priority.toLowerCase(),
      estimatedHours: hours,
      date: dateObj
    });

    const savedTask = await newTask.save();
    res.json(savedTask);

  } catch (err) {
    console.error("Create Task Error:", err);
    res.status(500).json({ message: "Server error while creating task" });
  }
};

// 3. update task
exports.updateTask = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "No data provided for update" });
    }

    let task = await Task.findOne({ _id: req.params.id, user: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (req.body.title) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json({ message: "Title cannot be empty" });
      }
      if (req.body.title.length > 100) {
        return res.status(400).json({ message: "Title too long (max 100 chars)" });
      }
      task.title = req.body.title;
    }
    if (req.body.priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (typeof req.body.priority !== 'string' || !validPriorities.includes(req.body.priority.toLowerCase())) {
        return res.status(400).json({ message: "Invalid priority" });
      }
      task.priority = req.body.priority.toLowerCase();
    }

    if (req.body.estimatedHours) {
      const hours = parseFloat(req.body.estimatedHours);
      if (isNaN(hours) || hours <= 0 || hours > 24 || (hours * 2) % 1 !== 0) {
        return res.status(400).json({ message: "Estimated hours must be between 0.5 and 24, in 0.5 increments." });
      }
      task.estimatedHours = hours;
    }
    if (req.body.subtasks) {
      if (!Array.isArray(req.body.subtasks)) {
        return res.status(400).json({ message: "Subtasks must be an array" });
      }
      if (req.body.subtasks.length > 20) {
        return res.status(400).json({ message: "Too many subtasks (max 20)" });
      }
      const isValidSubtasks = req.body.subtasks.every(st => st.title && typeof st.title === 'string' && st.title.length <= 80 && typeof st.isCompleted === 'boolean');
      if (!isValidSubtasks) {
         return res.status(400).json({ message: "All subtasks must have a valid title with length less than 80 and a boolean isCompleted field" });
      }
      
      task.subtasks = req.body.subtasks;
    }

    if (req.body.completedAt) {
      const dateObj = new Date(req.body.completedAt);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: "Invalid completedAt date" });
      }
      const now = new Date();
      console.log(dateObj.toISOString(), now.toISOString());
      console.log(dateObj.toISOString().getTime(), now.toISOString().getTime());
      // Create a 10-minute buffer into the future
      const bufferTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      if (dateObj > bufferTime) {
        return res.status(400).json({ message: "Task completion cannot be in the future!" });
      }
      task.completedAt = dateObj;
    }

    if (task.subtasks && task.subtasks.length > 0) {
      const allDone = task.subtasks.every(st => st.isCompleted);
      
      if (allDone && task.status === 'pending') {
        task.status = 'completed';
        task.completedAt = task.completedAt || new Date();
        
        const xp = calculateXP(task);
        task.awardedXP = xp;
        
        const user = await User.findById(req.user.id);
        user.xp += xp;
        user.level = Math.floor(user.xp / 100) + 1;
        await user.save();
      } 
      else if (!allDone && task.status === 'completed') {
        task.status = 'pending';
        task.completedAt = null;
        
        const xpToRefund = task.awardedXP || calculateXP(task);
        const user = await User.findById(req.user.id);
        user.xp = Math.max(0, user.xp - xpToRefund);
        user.level = Math.floor(user.xp / 100) + 1;
        await user.save();
        
        task.awardedXP = 0;
      }
    }

    const updatedTask = await task.save();
    res.json(updatedTask);
    
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Something went wrong" });
  }
};

// 4. delete task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.status === 'completed') {

      const xpToDeduct = task.awardedXP > 0 ? task.awardedXP : calculateXP(task);
      
      const user = await User.findById(req.user.id);
      if (user) {
        user.xp = Math.max(0, user.xp - xpToDeduct);
        user.level = Math.floor(user.xp / 100) + 1;
        await user.save();
      }
    }

    await Task.deleteOne({ _id: task._id });
    const updatedUser = await User.findById(req.user.id).select('xp level');
    res.json({ message: 'Task deleted', userXP: updatedUser.xp, userLevel: updatedUser.level });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//5. change the status of task
exports.toggleStatus = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const wasPending = task.status === 'pending';
    const user = await User.findById(req.user.id);

    if (wasPending) {
      task.status = 'completed';
      task.completedAt = new Date();
      if (task.subtasks) task.subtasks.forEach(st => st.isCompleted = true);

      const xpValue = calculateXP(task);
      task.awardedXP = xpValue; 
      user.xp += xpValue;
      
      const now = new Date();
      const lastDate = user.lastTaskDate ? new Date(user.lastTaskDate) : null;
      if (now.toDateString() !== (lastDate ? lastDate.toDateString() : "")) {
         const yesterday = new Date();
         yesterday.setDate(yesterday.getDate() - 1);
         if (lastDate && lastDate.toDateString() === yesterday.toDateString()) {
           user.streak += 1;
         } else {
           user.streak = 1;
         }
         user.lastTaskDate = now;
      }

    } else {
      task.status = 'pending';
      task.completedAt = null;
      
      if (task.subtasks) task.subtasks.forEach(st => st.isCompleted = false);
      const xpToRefund = task.awardedXP > 0 ? task.awardedXP : calculateXP(task);
      user.xp = Math.max(0, user.xp - xpToRefund);
      task.awardedXP = 0; 
    }

    user.level = Math.floor(user.xp / 100) + 1;
    await Promise.all([task.save(), user.save()]);

    res.json({ task, userXP: user.xp, userLevel: user.level, userStreak: user.streak });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//6. get stats
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
  
    const user = await User.findById(userId).select('streak');

    const totalTasks = await Task.countDocuments({ user: userId });
    const completedTasks = await Task.countDocuments({ user: userId, status: 'completed' });
    const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const datesArray = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0]; 
      datesArray.push(dateString);
    }

    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);

    const rawActivity = await Task.aggregate([
      { 
        $match: { 
          user: new mongoose.Types.ObjectId(userId), 
          status: 'completed',
          completedAt: { $gte: sevenDaysAgoDate }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          count: { $sum: 1 }
        }
      }
    ]);

    const activityMap = new Map();
    rawActivity.forEach(item => activityMap.set(item._id, item.count));

    const finalActivityArray = datesArray.map(date => activityMap.get(date) || 0);

    res.json({
      totalTasks,
      completedTasks,
      completionRate,
      streak: user ? user.streak : 0, 
      weeklyActivity: finalActivityArray
    });

  } catch (err) {
    console.error("Stats Error : ", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};


// Deleted code:-

// exports.createTask = async (req, res) => {
//   // console.log("Request Body:", req.body);
//   if(!req.body) return res.status(400).json({ message: "Request body is missing" });
//   let { title, estimatedHours, date, reward } = req.body;
//   if (!title || !estimatedHours || !date) return res.status(400).json({ message: "All fields required" });


//   if (!isValidYYYYMMDD(date)) 
//     return res.status(400).json({ message: "Enter valid date" });

//   estimatedHours = Number(estimatedHours);
//   if (Number.isNaN(estimatedHours) || estimatedHours < 0.1 || estimatedHours > 24) {
//     return res.status(400).json({ message: "Estimated hours must be between 0.1 and 24" });
//   }

//   if (title.length < 3 || title.length > 100) 
//     return res.status(400).json({ message: "Title must be 3 – 100 characters" });
//   if(reward && (reward.length < 3 || reward.length > 100))
//     return res.status(400).json({ message: "Reward must be 3 – 100 characters" });

//   const task = await Task.create({
//     user: req.user._id,
//     title,
//     estimatedHours,
//     date,
//     reward: reward || null
//   });

//   res.status(201).json(task);
// };

// exports.getTasksByDate = async (req, res) => {
//   if(!req.params) return res.status(400).json({ message: "Date is missing" });
//   const { date } = req.params;
//   if (!isValidYYYYMMDD(date)) 
//     return res.status(400).json({ message: "Enter valid date" });
//   const tasks = await Task.find({
//     user: req.user._id,
//     date,
//   });

//   res.json(tasks);
// };