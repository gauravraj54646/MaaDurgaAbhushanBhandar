import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import OrderSuccess from "./pages/OrderSuccess";
import About from "./pages/About";
import Disclaimer from "./pages/Disclaimer";
import ReturnPolicy from "./pages/ReturnPolicy";

import AdminDashboard from "./admin/AdminDashboard";
import AdminLoanDashboard from "./admin/AdminLoanDashboard";
import AddProduct from "./admin/AddProduct";
import AddLoanProduct from "./admin/AddLoanProduct";
import AdminProducts from "./admin/AdminProducts";
import AdminLoanProduct from "./admin/AdminLoanProduct";
import EditProduct from "./admin/EditProduct";
import EditLoanProduct from "./admin/EditLoanProduct";
import AdminOrders from "./admin/AdminOrders";
import AdminUsers from "./admin/AdminUsers";
import LoanAnalyticsDashboard from "./admin/LoanAnalyticsDashboard";

// Bill admin
// NOTE: only AddBillProduct exists so far. AdminBillDashboard,
// AdminBillProduct (list) and EditBillProduct still need to be built —
// same shape as their Loan counterparts. Routes are wired below so
// the app compiles once those files are added; until then the
// bill routes that reference them will fail to import.
import AddBillProduct from "./admin/AddBillProduct";
import AdminBillDashboard from "./admin/AdminBillDashboard";
import AdminBillProduct from "./admin/AdminBillProduct";
import EditBillProduct from "./admin/EditBillProduct";

// Family management
import People from "./admin/People";
import FamilyTree from "./admin/FamilyTree";
import AddVyapar from "./admin/AddVyapar";

function App() {
  return (
    <Router>
      <Navbar />

      <div className="main-content">
        <Routes>
          {/* =====================================================
              PUBLIC ROUTES
          ===================================================== */}

          <Route path="/" element={<Home />} />

          <Route path="/shop" element={<Shop />} />

          <Route
            path="/product/:id"
            element={<ProductDetail />}
          />

          <Route path="/cart" element={<Cart />} />

          <Route
            path="/checkout"
            element={<Checkout />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/ordersuccess"
            element={<OrderSuccess />}
          />

          <Route
            path="/about"
            element={<About />}
          />

          <Route
            path="/disclaimer"
            element={<Disclaimer />}
          />

          <Route
            path="/return"
            element={<ReturnPolicy />}
          />

          {/* =====================================================
              ADMIN ROUTES
          ===================================================== */}

          <Route
            path="/admin"
            element={<AdminDashboard />}
          />

          {/* -----------------------------------------------------
              PRODUCT ADMIN
          ----------------------------------------------------- */}

          <Route
            path="/admin/add-product"
            element={<AddProduct />}
          />

          <Route
            path="/admin/products"
            element={<AdminProducts />}
          />

          <Route
            path="/admin/edit-product/:id"
            element={<EditProduct />}
          />

          {/* -----------------------------------------------------
              LOAN ADMIN
          ----------------------------------------------------- */}

          <Route
            path="/admin/loan"
            element={<AdminLoanDashboard />}
          />

          <Route
            path="/admin/loan/add-loan"
            element={<AddLoanProduct />}
          />

          <Route
            path="/admin/loan/products"
            element={<AdminLoanProduct />}
          />

          <Route
            path="/admin/loan/edit-loan/:id"
            element={<EditLoanProduct />}
          />

          <Route
            path="/admin/loan/analytics"
            element={<LoanAnalyticsDashboard />}
          />

          {/* -----------------------------------------------------
              BILL ADMIN
          ----------------------------------------------------- */}

          <Route
            path="/admin/bill"
            element={<AdminBillDashboard />}
          />

          <Route
            path="/admin/bill/add-bill"
            element={<AddBillProduct />}
          />

          <Route
            path="/admin/bill/products"
            element={<AdminBillProduct />}
          />

          <Route
            path="/admin/bill/edit-bill/:id"
            element={<EditBillProduct />}
          />

          {/* -----------------------------------------------------
              ORDER / USER ADMIN
          ----------------------------------------------------- */}

          <Route
            path="/admin/orders"
            element={<AdminOrders />}
          />

          <Route
            path="/admin/users"
            element={<AdminUsers />}
          />

          {/* =====================================================
              FAMILY MANAGEMENT
          ===================================================== */}

          {/* People Directory */}

          <Route
            path="/admin/people"
            element={<People />}
          />

          {/* Family Tree - no person selected */}

          <Route
            path="/admin/family-tree"
            element={<FamilyTree />}
          />

          {/* Family Tree - specific person */}

          <Route
            path="/admin/family-tree/:personId"
            element={<FamilyTree />}
          />

                    <Route
            path="/admin/vyapar"
            element={<AddVyapar />}
          />
        </Routes>
      </div>

      <Footer />
    </Router>
  );
}

export default App;