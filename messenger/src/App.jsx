import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ThemeContext } from "./contexts/ThemeContext";
import Register from "./components/register";
import Login from "./components/login";
import Boot from "./pages/boot";
import { Toaster } from "react-hot-toast";
import { useConnectionStatus } from "../util/connection";
import Chats from "./components/chats";
import Status from "./components/Status";
import { isAccessTokenValid } from "./../util/auth";

function BootWrapper() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAccessTokenValid()) navigate("/chats");
      else navigate("/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);
  return <Boot />;
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useConnectionStatus({ pollInterval: 5000, timeout: 3000 });

  return (
    <Router>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 3000,
            style: { background: "#363636", color: "#fff" },
            success: { duration: 3000, theme: { primary: "#4aed88" } },
            error: { duration: 3000, theme: { primary: "#ff4b4b" } },
          }}
        />
        <Routes>
          <Route path="/" element={<BootWrapper />} />
          <Route path="/register" element={<Register />} />
          <Route path="/status" element={<Status />} />
          <Route path="/chats" element={<Chats />} />

          <Route path="/login" element={<Login />} />
        </Routes>
      </ThemeContext.Provider>
    </Router>
  );
}
