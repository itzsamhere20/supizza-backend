import express from "express";
import Product from "../models/product.js";

const router = express.Router();

/* -----------------------------
   Helper: Clean & Validate Sizes
------------------------------ */
const cleanSizes = (sizes) => {
  if (!sizes || typeof sizes !== "object") return {};

  const cleaned = {};

  for (const key in sizes) {
    const price = Number(sizes[key]);

    if (!isNaN(price) && price > 0) {
      cleaned[key] = price;
    }
  }

  return cleaned;
};

/* CREATE product */
router.post("/", async (req, res) => {
  try {
    const { sizes, ...rest } = req.body;

    const newProduct = new Product({
      ...rest,
      sizes: cleanSizes(sizes),
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* GET ALL Products */
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* GET SINGLE product */
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (error) {
    res.status(400).json({ error: "Invalid ID" });
  }
});

/* UPDATE product */
router.put("/:id", async (req, res) => {
  try {
    const { sizes, ...rest } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...rest,
        sizes: cleanSizes(sizes), // replace sizes safely
      },
      { new: true },
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* DELETE product */
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
