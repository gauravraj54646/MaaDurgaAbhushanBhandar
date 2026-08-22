const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
const connectDB1 = require("./config/db1");
const connectDB2 = require("./config/db2");

dotenv.config();

connectDB(); //mongodb atlas at jewelsdekhoo.com
//connectDB1(); //mongodb atlas at jewellsdekhoindia.com
//connectDB2(); //mongodb atlas at sauravrajofficial5059@gmail.com

const app = express();

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.FRONTEND_URL,
    ],
    credentials: true,
  }),
);

// ============================================================
// BODY PARSER
// ============================================================

app.use(express.json());

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/auth", require("./routes/authRoutes"));

app.use("/api/products", require("./routes/productRoutes"));

app.use("/api/orders", require("./routes/orderRoutes"));

app.use("/api/payment", require("./routes/paymentRoutes"));

app.use("/api/analytics", require("./routes/analyticsRoutes"));

app.use("/api/loans", require("./routes/loanRoutes"));

app.use("/api/bills", require("./routes/billRoutes"));

app.use('/api/vyapars', require('./routes/vyaparRoutes'));
// ============================================================
// PEOPLE / FAMILY SYSTEM
// ============================================================

// Person master records
app.use("/api/people", require("./routes/personRoutes"));

// Vyapar records
app.use("/api/vyapar", require("./routes/vyaparRoutes"));

// Relationships between people
app.use("/api/relationships", require("./routes/relationshipRoutes"));

// ============================================================
// PRODUCTION FRONTEND
// ============================================================

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));

  app.use((req, res) => {
    res.sendFile(path.resolve(__dirname, "../frontend/build/index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("ShopNest API is running in Development mode...");
  });
}

// ============================================================
// SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
