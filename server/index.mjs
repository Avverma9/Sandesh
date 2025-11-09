// server.mjs
import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import connectDB from "./db/cnf.mjs";
import { authMiddleware } from "./auth/jwt.mjs";
import { setupSocket } from "./websocket/websocket.mjs";

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("."));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const User = (await import("./models/user.mjs")).default;
    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch profile", error: err.message });
  }
});

const apiRoutes = (await import("./routes/route.mjs")).default;
app.use("/api", apiRoutes);

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    setupSocket(server); // attach socket.io to the same HTTP server

    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
