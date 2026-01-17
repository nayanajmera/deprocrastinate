    const express = require("express");
    const router = express.Router();
    const {protect} = require("../middleware/authMiddleware");
    const {createTask, getTasks, getTasksByDate, updateTask, deleteTask, toggleStatus, getStats} = require("../controllers/taskController");

    router.post("/", protect, createTask);
    router.get("/", protect, getTasks);
    router.put("/:id", protect, updateTask);
    router.delete("/:id", protect, deleteTask);

    router.patch('/:id/toggle', protect, toggleStatus); 
    router.get('/stats/overview', protect, getStats); 
module.exports = router;
