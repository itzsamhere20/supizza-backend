import express from "express";
import Admin from "../models/admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const router = express.Router();

// ---------------- In-memory OTP store ----------------
let otpStore = {};

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email & password required" });

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).json({ message: "Admin not found" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(400).json({ message: "Incorrect password" });

  const token = jwt.sign(
    { id: admin._id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  res.status(200).json({
    message: "Login successful",
    token,
    admin: { name: admin.name, email: admin.email },
  });
});

// ---------------- FORGOT PASSWORD (Send OTP) ----------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).json({ message: "Admin not found" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 }; // 5 min

  // Send OTP via email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.ADMIN_EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.ADMIN_EMAIL,
    to: email,
    subject: "Password Reset OTP",
    text: `Your OTP is: ${otp} (valid 5 minutes)`,
  });

  res.status(200).json({ message: "OTP sent to email" });
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

// ---------------- JWT Middleware ----------------
const protectAdmin = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    req.admin = admin;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};

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

// // ----------add admins----------------------------
// // POST /api/admin/add
// router.post("/add", protectAdmin, async (req, res) => {
//   try {
//     // Only super admin can add
//     if (!req.admin.superAdmin)
//       return res
//         .status(403)
//         .json({ message: "Access denied. Only super admin can add admins." });

//     const { name, email, password, superAdmin = false } = req.body;

//     if (!name || !email || !password)
//       return res
//         .status(400)
//         .json({ message: "Name, email, and password required" });

//     const existing = await Admin.findOne({ email });
//     if (existing)
//       return res
//         .status(400)
//         .json({ message: "Admin with this email already exists" });

//     const hashed = await bcrypt.hash(password, 10);
//     const newAdmin = await Admin.create({
//       name,
//       email,
//       password: hashed,
//       superAdmin,
//     });

//     res.status(201).json({
//       message: "Admin added successfully",
//       admin: {
//         name: newAdmin.name,
//         email: newAdmin.email,
//         superAdmin: newAdmin.superAdmin,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // GET /api/admin/all
// router.get("/all", protectAdmin, async (req, res) => {
//   try {
//     if (!req.admin.superAdmin)
//       return res.status(403).json({ message: "Access denied" });

//     const admins = await Admin.find(
//       {},
//       "name email superAdmin createdAt updatedAt",
//     ); // only needed fields
//     res.status(200).json(admins);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // edit other admin--------------
// // PUT /api/admin/:id
// router.put("/:id", protectAdmin, async (req, res) => {
//   try {
//     if (!req.admin.superAdmin)
//       return res.status(403).json({ message: "Access denied" });

//     const { name, email, password, superAdmin } = req.body;
//     const adminToUpdate = await Admin.findById(req.params.id);
//     if (!adminToUpdate)
//       return res.status(404).json({ message: "Admin not found" });

//     if (name) adminToUpdate.name = name;
//     if (email) adminToUpdate.email = email;
//     if (typeof superAdmin === "boolean") adminToUpdate.superAdmin = superAdmin;
//     if (password) adminToUpdate.password = await bcrypt.hash(password, 10);

//     await adminToUpdate.save();
//     res.status(200).json({ message: "Admin updated successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // -----delete admin-------
// // DELETE /api/admin/:id
// router.delete("/:id", protectAdmin, async (req, res) => {
//   try {
//     if (!req.admin.superAdmin)
//       return res.status(403).json({ message: "Access denied" });

//     const adminToDelete = await Admin.findById(req.params.id);
//     if (!adminToDelete)
//       return res.status(404).json({ message: "Admin not found" });

//     await adminToDelete.deleteOne();
//     res.status(200).json({ message: "Admin deleted successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });
export default router;
