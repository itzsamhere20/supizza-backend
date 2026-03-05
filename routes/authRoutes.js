import nodemailer from "nodemailer";

import express from "express";
import User from "../models/user.js";
import jwt from "jsonwebtoken";

const router = express.Router();
// ---------------- Configure Nodemailer ----------------
const transporter = nodemailer.createTransport({
  service: "gmail", // or another email service
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS, // app password for Gmail or SMTP password
  },
});

// ---------------- In-memory OTP store ----------------
let otpStore = {};

// Send OTP route
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

  // HTML email template
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
      <h2 style="color: #e11d48;">Your Supizza OTP Code</h2>
      <p>Hi,</p>
      <p>You requested a one-time password (OTP) for logging into your account.</p>
      <div style="margin: 20px 0; text-align: center;">
        <span style="
          font-size: 32px;
          font-weight: bold;
          padding: 15px 30px;
          border: 2px dashed #e11d48;
          border-radius: 10px;
          display: inline-block;
          letter-spacing: 5px;
        ">${otp}</span>
      </div>
      <p>This OTP is valid for <strong>5 minutes</strong>.</p>
      <p>If you did not request this code, please ignore this email.</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
      <p style="font-size: 12px; color: #666;">
        Supizza Team<br>
        support@supizza.com | +92 332 4384033
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Supizza" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code for Supizza Login",
      html: htmlContent,
    });

    console.log(`OTP for ${email}: ${otp}`); // For debugging
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ---------------- VERIFY OTP ----------------
router.post("/verify-otp", async (req, res) => {
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

  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, name: "", phone: "", city: "", address: "" });
    await user.save();
  }

  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      city: user.city,
      address: user.address,
    },
  });
});
// ---------------- JWT MIDDLEWARE ----------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};
// ---------------- GET CURRENT USER ----------------
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- UPDATE PROFILE ----------------
router.put("/update-profile", verifyToken, async (req, res) => {
  const { name, phone, city, address } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.city = city || user.city;
    user.address = address || user.address;

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        city: user.city,
        address: user.address,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- GET ALL USERS ----   for admin pannel------------
router.get("/all", async (req, res) => {
  try {
    const users = await User.find().select("-__v"); // exclude __v
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- GET SINGLE USER ----------------
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: "Invalid ID" });
  }
});

// ---------------- UPDATE USER ----------------
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, city, address } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name ?? user.name;
    user.email = email ?? user.email;
    user.phone = phone ?? user.phone;
    user.city = city ?? user.city;
    user.address = address ?? user.address;

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- DELETE USER ----------------
router.delete("/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= CONTACT FORM =================
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ---------------- Header ----------------
    const headerHtml = `
      <div style="
        background:#e11d48;
        padding:18px;
        text-align:center;
        color:white;
        font-family: Arial, sans-serif;
      ">
        <h1 style="margin:0;font-size:22px;">🍕 Supizza</h1>
        <p style="margin:4px 0 0 0;font-size:13px;opacity:0.9;">
         Premium pizza <strong style=" font-color: #e11d48;">delivered fast</strong> 
        </p>
      </div>
    `;

    // ---------------- Footer ----------------
    const footerHtml = `
      <div style="
        margin-top:30px;
        padding-top:20px;
        border-top:1px solid #eee;
        text-align:center;
        font-family: Arial, sans-serif;
        color:#6b7280;
        font-size:14px;
      ">
        
    <p style="margin-top:20px;">
      If you have any concerns, please contact us and we’ll be happy to assist you.
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #ddd;">

    <p style="font-size:12px; color:#555;">
      Contact us at 
      <a href="mailto:${process.env.EMAIL_USER}" style="color:#e11d48;">
        ${process.env.EMAIL_USER}
      </a>
      or call <strong>+92 332 4384033</strong>.
    </p>

        <p style="margin-top:10px;font-size:12px;color:#9ca3af;">
          © ${new Date().getFullYear()} Supizza. All rights reserved.
        </p>
      </div>
    `;

    // ---------------- Owner Email ----------------
    const ownerEmailHtml = `
      ${headerHtml}

      <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">

        <h2 style="color:#e11d48;">📩 New Contact Message</h2>

        <p style="margin-top:10px;">
          A new message has been submitted from your website contact form.
        </p>

        <table style="
          width:100%;
          border-collapse:collapse;
          margin-top:15px;
          font-size:14px;
        ">
          <tbody>

            <tr>
              <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Name</strong></td>
              <td style="padding:10px;border-bottom:1px solid #eee;">${name}</td>
            </tr>

            <tr>
              <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Email</strong></td>
              <td style="padding:10px;border-bottom:1px solid #eee;">${email}</td>
            </tr>

            <tr>
              <td style="padding:10px;"><strong>Message</strong></td>
              <td style="padding:10px;">${message}</td>
            </tr>

          </tbody>
        </table>

        ${footerHtml}

      </div>
    `;

    // ---------------- Customer Auto Reply ----------------
    const customerEmailHtml = `
      ${headerHtml}

      <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">

        <h2 style="color:#e11d48;">✅ Message Received</h2>

        <p>Hello <strong>${name}</strong>,</p>

        <p>
          Thank you for contacting <strong>Supizza</strong>.
          We have received your message and our team will get back to you shortly.
        </p>

        <h3 style="margin-top:20px;">Your Message:</h3>

        <div style="
          background:#f9fafb;
          padding:15px;
          border-left:4px solid #e11d48;
          margin-top:10px;
          font-size:14px;
        ">
          ${message}
        </div>

        <p style="margin-top:20px;">
          Best Regards,<br/>
          <strong>Supizza Support Team</strong>
        </p>

        ${footerHtml}

      </div>
    `;

    // ---------------- Send Emails ----------------
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.OWNER_EMAIL,
      subject: `📩 New Contact Message from ${name}`,
      html: ownerEmailHtml,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "We received your message",
      html: customerEmailHtml,
    });

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while sending message",
    });
  }
});
export default router;
