const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// routes
app.use("/api/pizzas", require("./routes/pizzaRoutes"));

const PORT = process.env.PORT || 5000;

// database + server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log("Server running on port", PORT);
    });
  })
  .catch((err) => console.log(err));
