const express = require("express");
const router = express.Router();

const { verifyToken, allowRoles } = require("../middleware/authMiddleware");

// Any logged-in user
router.get("/profile", verifyToken, (req, res) => {
  res.json({
    message: "User profile accessed",
    user: req.user,
  });
});

// Only STUDENT
router.get(
  "/student",
  verifyToken,
  allowRoles("student"),
  (req, res) => {
    res.json({ message: "Student content accessed" });
  }
);

// Only MENTOR
router.get(
  "/mentor",
  verifyToken,
  allowRoles("mentor"),
  (req, res) => {
    res.json({ message: "Mentor content accessed" });
  }
);

// Only ADMIN
router.get(
  "/admin",
  verifyToken,
  allowRoles("admin"),
  (req, res) => {
    res.json({ message: "Admin content accessed" });
  }
);

module.exports = router;
