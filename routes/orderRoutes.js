// =============================
// PLACE ORDER (COD ONLY)
// =============================

import express from "express";
import Order from "../models/order.js";
import Product from "../models/product.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const router = express.Router();

// ---------------- Helper: Generate Random Order ID ----------------
function generateOrderId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  let id = "";
  for (let i = 0; i < 2; i++)
    id += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++)
    id += digits[Math.floor(Math.random() * digits.length)];
  return id;
}

// ---------------- Place Order ----------------
router.post("/place-order", async (req, res) => {
  try {
    const { customer, cartItems, delivery } = req.body;

    if (!customer || !cartItems || cartItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Missing order data" });
    }

    let backendSubtotal = 0;

    // Rebuild cartItems with backend prices
    const backendCartItems = [];
    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: `Product not found: ${item.name}` });
      }

      let actualPrice = product.price;
      if (item.size && product.sizes?.get(item.size)) {
        actualPrice = product.sizes.get(item.size);
      }

      if (product.discount && product.discount > 0) {
        actualPrice = Math.round(
          actualPrice - (actualPrice * product.discount) / 100,
        );
      }

      backendSubtotal += actualPrice * item.quantity;

      backendCartItems.push({
        productId: item.productId,
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        price: actualPrice, // backend price
        image: item.image || "",
      });
    }

    const backendTax = Math.round(backendSubtotal * 0.16);
    const backendTotal = backendSubtotal + backendTax + delivery;

    // Save order
    const orderId = generateOrderId();
    const newOrder = new Order({
      orderId,
      customer,
      cartItems: backendCartItems,
      subtotal: backendSubtotal,
      tax: backendTax,
      delivery,
      totalAmount: backendTotal,
      paymentMethod: "COD",
      status: "pending",
    });

    await newOrder.save();
    // Prepare items HTML
    const itemsHtml = backendCartItems
      .map(
        (item) => `
<tr>

  <td style="
    padding: 8px;
    border-bottom: 1px solid #ddd;
  ">
    <div style="display: flex; align-items: center;">
      ${
        item.image
          ? `<img src="${item.image}" style="width:30px;height:30px;border-radius:5px;object-fit:contain;" />`
          : ""
      }
      <span style="display: inline-block; line-height: 30px; text-transform: capitalize; margin-left: 10px;">${item.name}</span>
    </div>
  </td>


<td style="padding:8px;text-align:center;border-bottom:1px solid #ddd;">${item.size ? item.size.toUpperCase() : "-"}</td>

 
  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">
    ${item.quantity}
  </td>

 
  <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">
    Rs ${item.price}
  </td>
</tr>
`,
      )
      .join("");

    // ---------------- Customer Email ----------------
    const customerEmailHtml = `
  <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">
    <h2 style="color:#e11d48;">🍕 Order Confirmation</h2>
    <p>Hi <strong>${customer.name}</strong>,</p>
    <p>Your order has been successfully placed. Your <strong>Order ID#${orderId}</strong>.</p>

    <h3>Order Summary:</h3>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #e11d48;">Item</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Size</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Qty</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #e11d48;">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Subtotal:</td>
          <td style="padding:8px;text-align:right;">Rs ${backendSubtotal}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Tax (16%):</td>
          <td style="padding:8px;text-align:right;">Rs ${backendTax}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Delivery:</td>
          <td style="padding:8px;text-align:right;">Rs ${delivery}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Grand Total:</td>
          <td style="padding:8px;text-align:right;font-weight:bold;">Rs ${backendTotal}</td>
        </tr>
      </tfoot>
    </table>

    <h3>Delivery Details:</h3>
    <p><strong>Address:</strong> ${customer.address}</p>
    <p><strong>Phone:</strong> ${customer.phone}</p>

    <p style="margin-top:20px;">We hope you enjoy your meal! 🍕</p>

    <!-- Footer -->
    <hr style="margin:20px 0; border:none; border-top:1px solid #ddd;">
    <p style="font-size:12px; color:#555;">
      If you have any questions about your order, feel free to contact us at
      <a href="mailto:${process.env.EMAIL_USER}" style="color:#e11d48;">${process.env.EMAIL_USER}</a>
      or call us at <strong>+92 332 4384933</strong>.
    </p>
     <p style="margin-top:10px;font-size:12px;color:#9ca3af;">
          © ${new Date().getFullYear()} Supizza. All rights reserved.
        </p>
  </div>
`;

    // ---------------- Owner Email ----------------
    const ownerEmailHtml = `
      <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">
        <h2 style="color:#e11d48;">📦 New Order Received</h2>
        <p><strong>Order ID: ${orderId}</strong></p>
        <h3>Customer Info:</h3>
        <p>Name: ${customer.name}</p>
        <p>Email: ${customer.email}</p>
        <p>Phone: ${customer.phone}</p>
        <p>Address: ${customer.address}</p>

        <h3>Order Details:</h3>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #e11d48;">Item</th>
              <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Size</th>
              <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Qty</th>
              <th style="text-align:right;padding:8px;border-bottom:2px solid #e11d48;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:8px;text-align:right;">Subtotal:</td>
              <td style="padding:8px;text-align:right;">Rs ${backendSubtotal}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:8px;text-align:right;">Tax (16%):</td>
              <td style="padding:8px;text-align:right;">Rs ${backendTax}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:8px;text-align:right;">Delivery:</td>
              <td style="padding:8px;text-align:right;">Rs ${delivery}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Grand Total:</td>
              <td style="padding:8px;text-align:right;font-weight:bold;">Rs ${backendTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // ---------------- Send Emails ----------------
    await resend.emails.send({
      from: "Supizza <onboarding@resend.dev>",
      to: [customer.email],
      subject: "Your Order is Confirmed!",
      html: customerEmailHtml,
    });

    await resend.emails.send({
      from: "Supizza <onboarding@resend.dev>",
      to: [process.env.OWNER_EMAIL],
      subject: `📦 New Order Received: ${orderId}`,
      html: ownerEmailHtml,
    });

    res
      .status(200)
      .json({ success: true, message: "Order placed successfully", orderId });
  } catch (error) {
    console.error("Order Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while placing order" });
  }
});

// ======================================================
// GET ORDERS BY USER EMAIL
// ======================================================
router.get("/user/:email", async (req, res) => {
  try {
    const orders = await Order.find({
      "customer.email": req.params.email,
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Fetch User Orders Error:", err);
    res.status(500).json({ message: "Server error fetching orders" });
  }
});

// ======================================================
// GET ALL ORDERS
// ======================================================
router.get("/all", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Fetch All Orders Error:", err);
    res.status(500).json({ message: "Server error fetching orders" });
  }
});

// ======================================================
// UPDATE ORDER STATUS
// ======================================================

router.put("/status/:id", async (req, res) => {
  try {
    const { status } = req.body;

    const allowed = ["pending", "cancelled", "out_for_delivery", "delivered"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ======================================================
    // SEND CANCELLATION EMAIL TO CUSTOMER
    // ======================================================
    if (status === "cancelled") {
      const itemsHtml = order.cartItems
        .map(
          (item) => `
      <tr>
   
  <td style="
    padding: 8px;
    border-bottom: 1px solid #ddd;
  ">
    <div style="display: flex; align-items: center;">
      ${
        item.image
          ? `<img src="${item.image}" style="width:30px;height:30px;border-radius:5px;object-fit:contain;" />`
          : ""
      }
      <span style="display: inline-block; line-height: 30px; text-transform: capitalize; margin-left: 10px;">${item.name}</span>
    </div>
  </td>
<td style="padding:8px;text-align:center;border-bottom:1px solid #ddd;">${item.size ? item.size.toUpperCase() : "-"}</td>
<td style="padding:8px;text-align:center;border-bottom:1px solid #ddd;">${item.quantity}</td>
<td style="padding:8px;text-align:right;border-bottom:1px solid #ddd;">Rs ${item.price}</td>
</tr>
    `,
        )
        .join("");

      const cancelEmailHtml = `
  <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">
    
    <h2 style="color:#e11d48;">❌ Order Cancelled</h2>
    <p>Hi <strong>${order.customer.name}</strong>,</p>

    <p>
      We sincerely apologize. Your 
      <strong>Order ID #${order.orderId}</strong> 
      has been cancelled due to unforeseen circumstances.
    </p>

    <h3 style="margin-top:20px;">Order Summary:</h3>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #e11d48;">Item</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Size</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Qty</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #e11d48;">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Subtotal:</td>
          <td style="padding:8px;text-align:right;">Rs ${order.subtotal}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Tax (16%):</td>
          <td style="padding:8px;text-align:right;">Rs ${order.tax}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Delivery:</td>
          <td style="padding:8px;text-align:right;">Rs ${order.delivery}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Grand Total:</td>
          <td style="padding:8px;text-align:right;font-weight:bold;">Rs ${order.totalAmount}</td>
        </tr>
      </tfoot>
    </table>

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

      await resend.emails.send({
        from: "Supizza <onboarding@resend.dev>",
        to: [order.customer.email],
        subject: `Your Order #${order.orderId} Has Been Cancelled`,
        html: cancelEmailHtml,
      });
    }

    // ======================================================
    // SEND OUT FOR DELIVERY EMAIL
    // ======================================================
    if (status === "out_for_delivery") {
      const itemsHtml = order.cartItems
        .map(
          (item) => `
<tr>
  <td style="padding:8px;border-bottom:1px solid #ddd;">
    <div style="display:flex;align-items:center;">
      ${
        item.image
          ? `<img src="${item.image}" style="width:30px;height:30px;border-radius:5px;object-fit:contain;" />`
          : ""
      }
      <span style="display:inline-block; line-height: 30px; text-transform: capitalize; margin-left: 10px;">${item.name}</span>
    </div>
  </td>
<td style="padding:8px;text-align:center;border-bottom:1px solid #ddd;">${item.size ? item.size.toUpperCase() : "-"}</td>
<td style="padding:8px;text-align:center;border-bottom:1px solid #ddd;">${item.quantity}</td>
<td style="padding:8px;text-align:right;border-bottom:1px solid #ddd;">Rs ${item.price}</td>
</tr>
`,
        )
        .join("");

      const outForDeliveryEmailHtml = `
  <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">
    
    <h2 style="color:#e11d48;">🚚 Your Order is On The Way!</h2>
    <p>Hi <strong>${order.customer.name}</strong>,</p>

    <p>
      Your <strong>Order ID #${order.orderId}</strong> 
      is now <strong>out for delivery</strong>.
    </p>

    <div style="
      margin:20px 0;
      padding:15px;
      background:#fff7ed;
      border-left:4px solid #e11d48;
      border-radius:6px;
    ">
      🕒 <strong>Estimated Delivery Time:</strong> 30 minutes
    </div>

    <h3 style="margin-top:20px;">Order Summary:</h3>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #e11d48;">Item</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Size</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #e11d48;">Qty</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #e11d48;">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Subtotal:</td>
          <td style="padding:8px;text-align:right;">Rs ${order.subtotal}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Tax (16%):</td>
          <td style="padding:8px;text-align:right;">Rs ${order.tax}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;">Delivery:</td>
          <td style="padding:8px;text-align:right;">Rs ${order.delivery}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Grand Total:</td>
          <td style="padding:8px;text-align:right;font-weight:bold;">Rs ${order.totalAmount}</td>
        </tr>
      </tfoot>
    </table>

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

      await resend.emails.send({
        from: "Supizza <onboarding@resend.dev>",
        to: [order.customer.email],
        subject: `🚚 Order #${order.orderId} is Out for Delivery`,
        html: outForDeliveryEmailHtml,
      });
    }

    // ======================================================
    // SEND DELIVERED EMAIL
    // ======================================================
    if (status === "delivered") {
      const deliveredEmailHtml = `
  <div style="font-family: Arial, sans-serif; padding:20px; color:#333;">
    
    <h2 style="color:#16a34a;">✅ Order Delivered Successfully</h2>
    <p>Hi <strong>${order.customer.name}</strong>,</p>

    <p>
      Your <strong>Order ID #${order.orderId}</strong> 
      has been successfully delivered.
    </p>

    <p style="margin-top:20px;">
      Thank you for choosing us! We hope you enjoyed your meal 🍕
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #ddd;">

    <p style="font-size:12px; color:#555;">
      Need assistance? Contact 
      <a href="mailto:${process.env.EMAIL_USER}" style="color:#16a34a;">
        ${process.env.EMAIL_USER}
      </a>
      or call <strong>+92 332 4384033</strong>.
    </p>
     <p style="margin-top:10px;font-size:12px;color:#9ca3af;">
          © ${new Date().getFullYear()} Supizza. All rights reserved.
        </p>
  </div>
`;

      await resend.emails.send({
        from: "Supizza <onboarding@resend.dev>",
        to: [order.customer.email],
        subject: `✅ Order #${order.orderId} Delivered`,
        html: deliveredEmailHtml,
      });
    }

    res.json({ message: "Status updated", order });
  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).json({ message: "Server error updating status" });
  }
});
// ======================================================
// DELETE SINGLE ORDER
// ======================================================
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Order not found" });

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ======================================================
// DELETE NULL ORDER IDS
// ======================================================
router.delete("/delete-null-orders", async (req, res) => {
  try {
    const result = await Order.deleteMany({
      $or: [
        { orderId: null },
        { orderId: "" },
        { orderId: { $exists: false } },
      ],
    });

    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
