import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },

    customer: {
      name: String,
      email: String,
      phone: String,
      city: String,
      address: String,
    },

    cartItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },

        name: String,
        image: String,

        size: {
          type: String,
          default: null,
        },

        price: {
          type: Number,
          required: true, // snapshot price
        },

        quantity: {
          type: Number,
          required: true,
        },
      },
    ],

    subtotal: Number,
    tax: Number,
    delivery: Number,
    totalAmount: Number,
    paymentMethod: String,

    status: {
      type: String,
      enum: ["pending", "cancelled", "out_for_delivery", "delivered"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Order", orderSchema);
