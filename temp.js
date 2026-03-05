import express from "express";
import bcrypt from "bcryptjs";
import Admin from "./models/admin.js";

const router = express.Router();

// TEMPORARY: Seed admin on deployed Render backend
router.post("/api/admin/seed", async (req, res) => {
  try {
    const existing = await Admin.findOne({
      email: "mirzasameer1322@gmail.com",
    });

    if (existing) {
      return res.json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash("Sam@1322!", 10);
    const admin = new Admin({
      name: "Sameer",
      email: "mirzasameer1322@gmail.com",
      password: hashedPassword,
    });

    await admin.save();
    res.json({ message: "Admin created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create admin" });
  }
});

export default router;
