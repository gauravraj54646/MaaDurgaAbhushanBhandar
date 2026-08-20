const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");

dotenv.config();

connectDB();

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
  })
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

// ============================================================
// PEOPLE / FAMILY SYSTEM
// ============================================================

// Person master records
app.use("/api/people", require("./routes/personRoutes"));

// Relationships between people
app.use(
  "/api/relationships",
  require("./routes/relationshipRoutes")
);

// ============================================================
// PRODUCTION FRONTEND
// ============================================================

if (process.env.NODE_ENV === "production") {
  app.use(
    express.static(path.join(__dirname, "../frontend/build"))
  );

  app.use((req, res) => {
    res.sendFile(
      path.resolve(
        __dirname,
        "../frontend/build/index.html"
      )
    );
  });
} else {
  app.get("/", (req, res) => {
    res.send(
      "ShopNest API is running in Development mode..."
    );
  });
}

// ============================================================
// SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});