import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <div
    style={{
      textAlign: "center",
      padding: "80px 20px",
      color: "#e4e4e7",
    }}
  >
    <h1 style={{ fontSize: "48px", margin: 0, color: "#f97316" }}>404</h1>
    <p style={{ color: "#a1a1aa", marginBottom: "24px" }}>
      The page you're looking for doesn't exist.
    </p>
    <Link
      to="/"
      style={{
        color: "#f97316",
        textDecoration: "underline",
      }}
    >
      Go back home
    </Link>
  </div>
);

export default NotFound;
