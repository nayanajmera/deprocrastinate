const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const connectDB = require("./config/db");
const mongoose = require('mongoose');
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const aiRoutes = require("./routes/ai");

connectDB().then(()=>console.log("Database connection established"));

const app = express();

const allowedOrigins = [
  "https://deprocrastinate.vercel.app"
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (mongoose.connection.readyState === 0) {
    return res.status(503).json({ message: "There was an internal server error. Please contact admin for it." });
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/db-ping', async (req, res) => {
    try {
        // Sends a lightweight ping directly to the MongoDB server
        await mongoose.connection.db.admin().ping();
        res.status(200).send('Database pinged successfully');
    } catch (error) {
        res.status(500).send('Database ping failed');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
