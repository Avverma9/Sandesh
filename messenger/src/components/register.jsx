import React, { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { createUser, loginUser, verifyOtp } from "../../redux/reducers/user";
import { isAccessTokenValid } from "../../util/auth";
import toast from "react-hot-toast";

export default function Register() {
  const [step, setStep] = useState("details");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [canResend, setCanResend] = useState(false);
  const [timer, setTimer] = useState(30);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const otpInputs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startResendTimer = useCallback(() => {
    clearTimer();
    setCanResend(false);
    setTimer(30);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearTimer();
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // If user already has a valid token, redirect to chats
  useEffect(() => {
    if (isAccessTokenValid()) navigate("/chats");
  }, [navigate]);

  const handleProfilePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      const loadingToast = toast.loading("Creating your account...");
      const formData = new FormData();
      formData.append("username", username.trim());
      formData.append("email", email.trim());
      formData.append("mobile", mobile.trim());
      formData.append("bio", bio);
      if (imageFile) formData.append("files", imageFile);

      await dispatch(createUser(formData)).unwrap();
      toast.dismiss(loadingToast);
      toast.success("Account created successfully!");

      const otpToast = toast.loading("Sending OTP...");
      await dispatch(loginUser({ email: email.trim() })).unwrap();
      toast.dismiss(otpToast);
      toast.success("OTP sent to your email!");

      setStep("otp");
      setOtp(["", "", "", ""]);
      startResendTimer();
    } catch (err) {
      toast.dismiss();
      toast.error(
        typeof err === "string"
          ? err
          : "Registration failed or already registered. Please log in."
      );
      navigate("/login");
    }
  };

  const handleOtpChange = (el, index) => {
    const value = el.value;
    if (!/^\d?$/.test(value)) return;
    setOtp((prev) => prev.map((d, i) => (i === index ? value : d)));
    if (value && index < otpInputs.length - 1) {
      otpInputs[index + 1].current?.focus();
    }
  };

  const handleOtpBackspace = (e, index) => {
    if (e.key === "Backspace" && index > 0 && otp[index] === "") {
      otpInputs[index - 1].current?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    try {
      await dispatch(loginUser({ email: email.trim() })).unwrap();
      setOtp(["", "", "", ""]);
      startResendTimer();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to resend OTP.", {
        duration: 3000,
        position: "top-center",
      });
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const finalOtp = otp.join("");
    if (finalOtp.length !== 4) {
      return toast.error("Please enter the 4-digit OTP.");
    }
    try {
      const verifyToast = toast.loading("Verifying OTP...");
      await dispatch(verifyOtp({ email: email.trim(), otp: finalOtp })).unwrap();
      toast.dismiss(verifyToast);
      toast.success("Registration successful!");
      navigate("/");
    } catch (err) {
      toast.dismiss();
      toast.error(
        typeof err === "string" ? err : "Invalid OTP. Please try again."
      );
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes panBackground {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 50%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 50%; }
        }
        .animate-panBackground {
          background-size: 200% 200%;
          animation: panBackground 15s ease-in-out infinite;
        }
        .card-3d-effect {
          transform: rotateY(0deg) rotateX(0deg);
          transition: transform 0.5s ease;
          transform-style: preserve-3d;
        }
        .card-3d-effect:hover {
          transform: rotateY(-5deg) rotateX(3deg) scale(1.02);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>

      <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700 font-sans overflow-hidden animate-panBackground p-4 [perspective:1000px]">
        <header className="absolute top-0 left-0 right-0">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span className="text-2xl font-extrabold tracking-wide drop-shadow-md">
                Sandesh
              </span>
            </div>
            <div className="hidden sm:block text-white/80 text-sm">
              Connect anywhere, anytime
            </div>
          </div>
        </header>

        <div className="w-full max-w-4xl bg-white/20 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden md:flex card-3d-effect mt-16">
          <div className="hidden md:flex flex-col items-center justify-center w-1/2 p-8 bg-white/10">
            <div className="w-24 h-24 mb-4">
              <svg
                className="w-full h-full text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </div>
            <h1 className="text-5xl font-bold text-white drop-shadow-md mb-4">
              Sandesh
            </h1>
            <p className="text-lg text-white/80 text-center">
              Apno se judein, kahin bhi, kabhi bhi.
            </p>
          </div>

          <div className="w-full md:w-1/2 p-6 md:p-8 text-white">
            {step === "details" && (
              <form onSubmit={handleCreateAccount} className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-center mb-6 drop-shadow-md">
                  Create Account
                </h2>

                <div className="flex flex-col items-center mb-6">
                  <div
                    className="w-28 h-28 rounded-full bg-white/30 flex items-center justify-center text-gray-100 overflow-hidden cursor-pointer border-2 border-white/50"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Select profile picture"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-12 h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleProfilePicChange}
                    className="hidden"
                    accept="image/*"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-sm font-medium hover:underline"
                  >
                    Choose Profile Picture
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/30 rounded-lg placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-white/70"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/30 rounded-lg placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-white/70"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/30 rounded-lg placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-white/70"
                  />
                  <textarea
                    placeholder="Bio (Optional)"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-4 py-3 bg-white/30 rounded-lg placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-white/70 resize-none h-24"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-white text-blue-600 font-bold py-3 px-4 rounded-lg mt-8 shadow-lg transition-transform transform hover:scale-105"
                >
                  Create Account & Send OTP
                </button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-center mb-4 drop-shadow-md">
                  Verify OTP
                </h2>
                <p className="text-center text-white/90 mb-6">
                  We've sent a 4-digit OTP to{" "}
                  <span className="font-semibold">{email}</span>
                </p>

                <div className="flex justify-center space-x-2 md:space-x-4 mb-8">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="1"
                      className="w-12 h-12 md:w-14 md:h-14 text-center text-2xl font-bold bg-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/70"
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target, index)}
                      onKeyDown={(e) => handleOtpBackspace(e, index)}
                      ref={otpInputs[index]}
                      autoFocus={index === 0}
                      aria-label={`OTP digit ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full bg-white text-blue-600 font-bold py-3 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
                >
                  Verify OTP
                </button>

                <div className="flex justify-between items-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("details");
                      clearTimer();
                    }}
                    className="text-white/80 text-sm hover:underline"
                  >
                    Wrong email? Go back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!canResend}
                    className={`text-sm hover:underline ${
                      canResend
                        ? "text-white/80"
                        : "text-white/50 cursor-not-allowed"
                    }`}
                  >
                    {canResend ? "Resend OTP" : `Resend in ${timer}s`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <footer className="absolute bottom-4 left-0 right-0">
          <div className="mx-auto max-w-6xl px-4 text-center text-white/80 text-sm">
            <p>
              Made with ❤️ in India • Developed by{" "}
              <span className="font-semibold">Avverma</span>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
