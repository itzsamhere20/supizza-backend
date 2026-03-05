import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  name: { type: String, default: "" }, // optional
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // superAdmin: { type: Boolean, default: false },
});

const Admin = mongoose.model("Admin", AdminSchema);
export default Admin;
