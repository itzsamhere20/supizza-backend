import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: "" },
  city: { type: String, default: "" },
  address: { type: String, default: "" },
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
