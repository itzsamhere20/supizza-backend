const mongoose = require("mongoose");

const pizzaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number, // percentage
      default: 0,
    },
    image: {
      type: String, // base64
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Pizza", pizzaSchema);
