const mongoose = require('mongoose');

const SubtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isCompleted: { type: Boolean, default: false }
});

const TaskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  estimatedHours: { type: Number, default: 0.5 },
  subtasks: [SubtaskSchema],
  date: { type: Date, default: Date.now },
  completedAt: { type: Date },
  
  awardedXP: { type: Number, default: 0 } 
}, {timestamps: true});

module.exports = mongoose.model('Task', TaskSchema);