import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { protect } from "./middleware/authMiddleware.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js"; // ← IMPORTANT
import authRoutes from "./routes/authRoutes.js"; // ← NEW
import adminRoutes from "./routes/adminRoutes.js"; // ← NEW
const app = express();

// ---------------- Middlewares ----------------
app.use(cors());
app.use(express.json());

// ---------------- Routes ----------------
app.use("/api/products", productRoutes);
app.use("/api/orders", protect, orderRoutes); // ← THIS LINE MUST EXIST
app.use("/api/auth", authRoutes); // ← NEW
app.use("/api/admin", adminRoutes); // ← NEW

// ---------------- MongoDB Connection ----------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// ---------------- Server ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ---------------- Server Error Handler ----------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});
