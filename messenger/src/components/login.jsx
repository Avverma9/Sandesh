import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { loginUser, verifyOtp } from "../../redux/reducers/user";
import { isAccessTokenValid } from "../../util/auth";

export default function Login() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const otpInputs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [canResend, setCanResend] = useState(false);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // If user already has a valid token, redirect to chats
  useEffect(() => {
    if (isAccessTokenValid()) navigate("/chats");
  }, [navigate]);

  const startResendTimer = () => {
    setCanResend(false);
    setTimer(30);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    try {
      setIsSendingOtp(true);
      const resultAction = await dispatch(loginUser({ email }));
      if (resultAction?.payload === "User not found") {
        // Redirect to register page if user not found
        navigate("/register");
        return;
      }
      // Only proceed to OTP step if the request was successful
      if (!resultAction.error) {
        setStep("otp");
        setOtp(["", "", "", ""]);
        startResendTimer();
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return;
    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);
    if (element.value !== "" && index < 3) {
      otpInputs[index + 1].current.focus();
    }
  };

  const handleOtpBackspace = (e, index) => {
    if (e.key === "Backspace" && index > 0 && otp[index] === "") {
      otpInputs[index - 1].current.focus();
    }
  };

  const handleResendOtp = () => {
    if (!canResend) return;
    startResendTimer();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      setIsVerifying(true);
      const finalOtp = otp.join("");
      const resultAction = await dispatch(verifyOtp({ email: email.trim(), otp: finalOtp }));
      localStorage.setItem("loggedInUserId", resultAction?.payload?.user?._id);
      if (verifyOtp.fulfilled.match(resultAction)) {
        toast.success("Logged in successfully!");
        navigate("/chats");
      } else {
        const msg = resultAction.payload || "Invalid OTP. Please try again.";
        toast.error(typeof msg === "string" ? msg : "Login failed");
      }
    } catch (err) {
      toast.error("Login failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
            <p className="text-lg text-white/80 text-center">Welcome back.</p>
          </div>

          <div className="w-full md:w-1/2 p-6 md:p-8 text-white">
            {step === "email" && (
              <form onSubmit={handleSendOtp} className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-center mb-6 drop-shadow-md">
                  Login
                </h2>
                <p className="text-center text-white/90 mb-6">
                  Enter your email address to continue.
                </p>
                <div className="space-y-4">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/30 rounded-lg placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-white/70"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className={`w-full bg-white text-blue-600 font-bold py-3 px-4 rounded-lg mt-8 shadow-lg transition-transform transform ${
                    isSendingOtp ? "opacity-80 cursor-not-allowed" : "hover:scale-105"
                  } flex items-center justify-center gap-2`}
                >
                  <span>{isSendingOtp ? "Sending OTP" : "Send OTP"}</span>
                  {isSendingOtp && (
                    <svg className="w-5 h-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                </button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-center mb-4 drop-shadow-md">
                  Verify OTP
                </h2>
                <p className="text-center text-white/90 mb-6">
                  We sent a 4-digit OTP to{" "}
                  <span className="font-semibold">{email}</span>.
                </p>
                <div className="flex justify-center space-x-2 md:space-x-4 mb-8">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      type="text"
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="1"
                      className="w-12 h-12 md:w-14 md:h-14 text-center text-2xl font-bold bg-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/70"
                      value={data}
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
                  disabled={isVerifying}
                  className={`w-full bg-white text-blue-600 font-bold py-3 px-4 rounded-lg shadow-lg transition-transform transform ${
                    isVerifying ? "opacity-80 cursor-not-allowed" : "hover:scale-105"
                  } flex items-center justify-center gap-2`}
                >
                  <span>{isVerifying ? "Verifying" : "Verify & Login"}</span>
                  {isVerifying && (
                    <svg className="w-5 h-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                </button>
                <div className="flex justify-between items-center mt-4">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-center text-white/80 text-sm hover:underline"
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!canResend}
                    className={`text-center text-sm hover:underline ${
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
