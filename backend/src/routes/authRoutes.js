const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

module.exports = router;

const pool = require("../config/db");
const protect = require("../middleware/authMiddleware");

router.get("/find", protect, async (req, res) => {
  try {
    const { email } = req.query;
    const result = await pool.query(
      "SELECT id, username, email FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
