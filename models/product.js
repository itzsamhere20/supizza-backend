import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
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
      type: Number,
      default: 0,
    },

    category: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      required: true,
    },

    /* ✅ NEW SIZES FIELD */
    sizes: {
      type: Map,
      of: Number, // sm:1200 md:1500 etc
      default: {},
    },
  },
  { timestamps: true },
);

export default mongoose.model("Product", productSchema);
