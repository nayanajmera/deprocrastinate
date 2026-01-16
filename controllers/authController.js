const User = require('../models/User');
const Task = require('../models/Task'); // <--- IMPORT TASK MODEL
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

//1. register User
exports.registerUser = async (req, res) => {
  if(!req.body) {
    return res.status(400).json({ message: 'No data provided' });
  }
  const { name, email, password } = req.body;

  //validations:-
  if(!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  if(typeof password !== 'string'){
    return res.status(400).json({ message: 'Password must be a string' });
  }
  if(password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password : hashedPassword });
    user.streak = 0;
    user.xp = 0;
    user.level = 1;
    await user.save();

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      token: generateToken(user.id),
      xp: user.xp,
      level: user.level,
      streak: user.streak,
      weeklyActivity: [0,0,0,0,0,0,0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//2. Login User
exports.loginUser = async (req, res) => {
  if(!req.body) {
    return res.status(400).json({ message: 'No data provided' });
  }
  const { email, password } = req.body;
  if(!email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }
  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        token: generateToken(user.id),
        xp: user.xp,
        level: user.level,
        streak: user.streak
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//3. Get Current User Profile with Weekly Activity
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });

    // calculate the last 7 days range
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // find ALL completed tasks in this range
    const recentTasks = await Task.find({
      user: req.user.id,
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    });

    // group them into an array [Day1, Day2, ... Today]
    const activityMap = [0, 0, 0, 0, 0, 0, 0];

    recentTasks.forEach(task => {
      const completedDate = new Date(task.completedAt);
      completedDate.setHours(0, 0, 0, 0);

      const diffTime = completedDate - sevenDaysAgo;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < 7) {
        activityMap[diffDays] += 1;
      }
    });

    //sending response to frontend
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      xp: user.xp,
      level: user.level,
      streak: user.streak,
      weeklyActivity: activityMap
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//4. update Profile Details (Name & Email)
exports.updateDetails = async (req, res) => {
  try {
    if(!req.body){
      return res.status(400).json({ message: 'No data provided' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      xp: updatedUser.xp,
      level: updatedUser.level,
      streak: updatedUser.streak
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message : "Something went wrong" });
  }
};

//5. update password
exports.updatePassword = async (req, res) => {
  if(!req.body) {
    return res.status(400).json({ message: 'No data provided' });
  }
  const { currentPassword, newPassword } = req.body;
  try {
    if(newPassword && newPassword.length < 8){
      return res.status(400).json({ message: 'New password is too short' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    //Hash the NEW password manually
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    //Save
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// 6. delete account
exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 1. Deleting all tasks here of that user
    await Task.deleteMany({ user: req.user.id });
    
    // 2. Deleting the user
    await user.deleteOne();
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};