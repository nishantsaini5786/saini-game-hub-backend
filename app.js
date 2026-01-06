require("dotenv").config();

// ======================
// 1️⃣ Required modules
// ======================
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// 2️⃣ Middleware
// ======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ CORS updated for frontend + credentials
app.use(
  cors({
    origin: "https://sainigamehub-db.netlify.app", // full frontend URL with HTTPS
    credentials: true
  })
);

// ======================
// 3️⃣ Root test route
// ======================
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ======================
// 4️⃣ MongoDB Atlas connection
// ======================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ======================
// 5️⃣ Gmail validation
// ======================
const isValidGmail = (email) => {
  return validator.isEmail(email) && email.endsWith("@gmail.com");
};

// ======================
// 6️⃣ User Schema
// ======================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  contact: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

// ======================
// 7️⃣ Multer (uploads)
// ======================
const uploadDir = path.join(__dirname, "uploads/profiles");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// serve uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================
// 8️⃣ Register
// ======================
app.post("/register", async (req, res) => {
  try {
    const { name, username, contact, email, password } = req.body;

    if (!name || !username || !contact || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (!isValidGmail(email)) {
      return res.status(400).json({ error: "Only Gmail allowed" });
    }

    const exists = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (exists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username,
      contact,
      email,
      password: hashed
    });

    // ✅ Cookie updated for cross-origin
    res.cookie(
      "user",
      JSON.stringify({ id: user._id, username: user.username }),
      {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        secure: true, // HTTPS required
        sameSite: "none" // cross-origin allowed
      }
    );

    res.json({ success: true, message: "Registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 9️⃣ Login
// ======================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Wrong password" });

    // ✅ Cookie updated for cross-origin
    res.cookie(
      "user",
      JSON.stringify({ id: user._id, username: user.username }),
      {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: "none"
      }
    );

    res.json({ success: true, message: "Login successful" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 🔟 Check login
// ======================
app.get("/check", (req, res) => {
  try {
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    res.json({ loggedIn: !!user, user });
  } catch {
    res.json({ loggedIn: false });
  }
});

// ======================
// 1️⃣1️⃣ Upload profile image
// ======================
app.post("/upload-profile", upload.single("profileImage"), async (req, res) => {
  try {
    const cookie = req.cookies.user;
    if (!cookie) return res.status(401).json({ error: "Not logged in" });

    const { id } = JSON.parse(cookie);
    const user = await User.findById(id);

    user.profileImage = req.file.filename;
    await user.save();

    res.json({
      success: true,
      imageUrl: `/uploads/profiles/${req.file.filename}`
    });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// ======================
// 1️⃣2️⃣ Logout
// ======================
app.get("/logout", (req, res) => {
  res.clearCookie("user", { secure: true, sameSite: "none" });
  res.json({ success: true });
});

// ======================
// 🔚 Start server
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
