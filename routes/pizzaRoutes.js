const express = require("express");
const Pizza = require("../models/pizza");

const router = express.Router();

/* CREATE PIZZA */
router.post("/", async (req, res) => {
  try {
    const pizza = new Pizza(req.body);
    await pizza.save();
    res.status(201).json(pizza);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* GET ALL PIZZAS */
router.get("/", async (req, res) => {
  try {
    const pizzas = await Pizza.find();
    res.json(pizzas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* GET SINGLE PIZZA */
router.get("/:id", async (req, res) => {
  try {
    const pizza = await Pizza.findById(req.params.id);
    if (!pizza) return res.status(404).json({ message: "Pizza not found" });
    res.json(pizza);
  } catch (error) {
    res.status(400).json({ error: "Invalid ID" });
  }
});

/* UPDATE PIZZA */
router.put("/:id", async (req, res) => {
  try {
    const pizza = await Pizza.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(pizza);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* DELETE PIZZA */
router.delete("/:id", async (req, res) => {
  try {
    await Pizza.findByIdAndDelete(req.params.id);
    res.json({ message: "Pizza deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
