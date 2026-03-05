import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "./models/admin.js";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const existing = await Admin.findOne({ email: "mirzasameer1322@gmail.com" });
  if (!existing) {
    const hashedPassword = await bcrypt.hash("Sam@1322!", 10);
    const admin = new Admin({
      name: "Sameer",
      email: "mirzasameer1322@gmail.com",
      password: hashedPassword,
    });
    await admin.save();
    console.log("Initial admin created successfully");
  } else {
    console.log("Admin already exists");
  }
  process.exit();
});
