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

// Required for Render cookies
app.set("trust proxy", 1);

// ======================
// 3️⃣ CORS (Final)
// ======================
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "https://sainigamehub-db.netlify.app",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS Blocked: " + origin));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// OPTIONS preflight fix
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    return res.sendStatus(200);
  }
  next();
});

// ======================
// 4️⃣ Test route
// ======================
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ======================
// 5️⃣ MongoDB connection
// ======================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ======================
// 6️⃣ Gmail validation
// ======================
const isValidGmail = (email) =>
  validator.isEmail(email) && email.endsWith("@gmail.com");

// ======================
// 7️⃣ User Schema
// ======================
const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  contact: String,
  email: { type: String, unique: true },
  password: String,
  profileImage: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// ======================
// 8️⃣ Multer Uploads (Profile Images)
// ======================
const uploadDir = path.join(__dirname, "uploads/profiles");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================
// 9️⃣ Register User
// ======================
app.post("/register", async (req, res) => {
  try {
    const { name, username, contact, email, password } = req.body;

    if (!name || !username || !contact || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    if (!isValidGmail(email))
      return res.status(400).json({ error: "Only Gmail allowed" });

    const exists = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username,
      contact,
      email,
      password: hashed,
    });

    res.cookie(
      "user",
      JSON.stringify({ id: user._id, username: user.username }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      }
    );

    res.json({ success: true, message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 🔟 Login User
// ======================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Wrong password" });

    res.cookie(
      "user",
      JSON.stringify({ id: user._id, username: user.username }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      }
    );

    res.json({ success: true, message: "Login successful" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 1️⃣1️⃣ Check Auth
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
// 1️⃣2️⃣ Start Server
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
