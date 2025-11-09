
export default function Boot() {
  return (
    <>
      <style>{`
        @keyframes fadeInRise {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes floatFly {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }

        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.4)); }
          50% { filter: drop-shadow(0 0 16px rgba(255,255,255,0.7)); }
        }

        @keyframes panBackground {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 50%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes flyBy {
          0% { transform: translateX(0px); opacity: 0; }
          20%,80% { opacity: 1; }
          100% { transform: translateX(180px); opacity: 0; }
        }

        .animate-fadeInRise { animation: fadeInRise 1s ease-out forwards; }
        .animate-floatFly { animation: floatFly 4s ease-in-out infinite; }
        .animate-pulseGlow { animation: pulseGlow 3s ease-in-out infinite; }
        .animate-panBackground {
          background-size: 200% 200%;
          animation: panBackground 15s ease-in-out infinite;
        }
        .animate-flyBy { animation: flyBy 2s linear infinite; }
      `}</style>

      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-cyan-500 via-blue-600 to-purple-700 font-sans overflow-hidden animate-panBackground relative p-4">
        <div className="flex flex-col items-center text-center text-white animate-fadeInRise">
          <div className="mb-8 w-20 h-20 md:w-24 md:h-24 animate-floatFly animate-pulseGlow">
            <svg
              className="w-full h-full"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              ></path>
            </svg>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-md">
            Sandesh
          </h1>

          <div className="w-48 h-10 relative">
            <div className="absolute top-0 left-0 w-10 h-10 animate-flyBy">
              <svg
                className="w-full h-full text-white rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-6 left-0 right-0 text-center text-white/70 text-sm animate-fadeInRise"
          style={{ animationDelay: "0.2s" }}
        >
          <p>Made with ❤️ in India</p>
          <p className="mt-1">Developed by Avverma</p>
        </div>
      </div>
    </>
  );
}
