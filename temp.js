import express from "express";
import bcrypt from "bcryptjs";
import Admin from "./models/admin.js";

const router = express.Router();

// TEMP: Reset admin password to "123"
router.post("/api/admin/reset-password-temp", async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const hashedPassword = await bcrypt.hash("123", 10);
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: `Admin password reset to 123 for ${admin.email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
