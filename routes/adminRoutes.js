import express from "express";
import Admin from "../models/admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const router = express.Router();

// ---------------- In-memory OTP store ----------------
let otpStore = {};

// ---------------- FORGOT PASSWORD (Send OTP) ----------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).json({ message: "Admin not found" });

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 }; // 5 min expiry

  // ---------------- Nodemailer Transport ----------------
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587, // TLS port
    secure: false, // STARTTLS
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.ADMIN_EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.sendMail({
      from: `"SuPizza Admin" <${process.env.ADMIN_EMAIL}>`,
      to: email,
      subject: "SuPizza Password Reset OTP",
      text: `Your OTP is: ${otp}\nValid for 5 minutes`,
    });

    res.status(200).json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("Email send failed:", err);
    res.status(500).json({ message: "Email send failed" });
  }
});

// ---------------- VERIFY OTP ----------------
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ message: "Email & OTP required" });

  const record = otpStore[email];
  if (!record) return res.status(400).json({ message: "OTP not found" });
  if (record.expires < Date.now()) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }
  if (record.otp !== otp)
    return res.status(400).json({ message: "Invalid OTP" });

  delete otpStore[email];
  res.status(200).json({ message: "OTP verified" });
});

// ---------------- RESET PASSWORD ----------------
router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword)
    return res.status(400).json({ message: "Email & new password required" });

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).json({ message: "Admin not found" });

  const hashed = await bcrypt.hash(newPassword, 10);
  admin.password = hashed;
  await admin.save();

  res.status(200).json({ message: "Password updated successfully" });
});

// ---------------- UPDATE PROFILE ----------------
router.put("/update-profile", protectAdmin, async (req, res) => {
  const { name, password } = req.body;

  if (!name && !password)
    return res
      .status(400)
      .json({ message: "Provide at least a name or password to update" });

  if (name) req.admin.name = name;
  if (password) {
    const hashed = await bcrypt.hash(password, 10);
    req.admin.password = hashed;
  }

  await req.admin.save();

  // Generate a new token after update
  const newToken = jwt.sign(
    { id: req.admin._id, email: req.admin.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  res.status(200).json({
    message: "Profile updated successfully",
    admin: { name: req.admin.name, email: req.admin.email },
    token: newToken, // send fresh token
  });
});
// GET /api/admin/me
router.get("/me", protectAdmin, async (req, res) => {
  res.status(200).json({
    admin: { name: req.admin.name, email: req.admin.email },
  });
});
export default router;
