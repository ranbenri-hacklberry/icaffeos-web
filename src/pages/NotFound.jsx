import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coffee, Home, Compass, Cpu, Server, Terminal } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  const shortStory = [
    "השרת שלנו ניסה להכין הפוך חזק מדי, והקצף כיסה את כל בסיס הנתונים.",
    "עכשיו הוא עסוק בניגוב שאילתות מהרצפה ובניסיון להחזיר את ה-Wi-Fi לחיים.",
    "בינתיים, אולי כדאי שתיקחו שלוק מהקפה שלכם ותחזרו למקום בטוח יותר?"
  ];

  const jokes = [
    "404: אפילו מכונת הקפה לא מוצאת את הדרך לפה. 🤖",
    "מישהו שפך את הבריסטה על השרת? 🤦‍♂️☕️",
    "ההפוך שלך הפך להיות... לא נמצא. 🙃",
    "הדף הזה יצא להפסקה קצרה בקוסטה ריקה. 🏖️"
  ];

  const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-right overflow-hidden relative font-heebo" dir="rtl">
      {/* Soft Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute top-[10%] left-[-5%] w-[40%] h-[40%] bg-indigo-200/50 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 18, repeat: Infinity, delay: 2 }}
          className="absolute bottom-[10%] right-[-5%] w-[50%] h-[50%] bg-slate-200 rounded-full blur-[150px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-w-2xl w-full bg-white border border-slate-200 p-10 md:p-16 rounded-[4rem] text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]"
      >
        {/* Tech & Coffee Iconography */}
        <div className="flex justify-center items-center gap-6 mb-10 overflow-hidden px-4">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="text-slate-300"
          >
            <Server size={48} strokeWidth={1.5} />
          </motion.div>

          <div className="w-px h-12 bg-slate-100" />

          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="text-indigo-600"
          >
            <Coffee size={64} strokeWidth={2.5} />
          </motion.div>

          <div className="w-px h-12 bg-slate-100" />

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="text-slate-300"
          >
            <Terminal size={48} strokeWidth={1.5} />
          </motion.div>
        </div>

        <motion.h1
          className="text-[100px] font-black leading-none mb-6 text-slate-800 select-none tracking-tighter"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          404
        </motion.h1>

        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-8">אופס! הדף הלך לאיבוד במטבח...</h2>

        {/* Short Story Section */}
        <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] mb-12 text-right relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-slate-100 group-hover:text-indigo-50 transition-colors">
            <Cpu size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            {shortStory.map((line, idx) => (
              <motion.p
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (idx * 0.2) }}
                className={`text-slate-600 font-bold leading-relaxed mb-2 last:mb-0 ${idx === 2 ? 'text-indigo-600' : ''}`}
              >
                {line}
              </motion.p>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/mode-selection')}
            className="flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-slate-200 transition-all active:scale-95"
          >
            <Home size={22} />
            ברח חזרה הביתה
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 py-5 rounded-3xl font-black text-xl hover:bg-slate-50 transition-all active:scale-95"
          >
            <Compass size={22} />
            קח אותי חזרה
          </motion.button>
        </div>

        <p className="mt-12 text-slate-300 font-bold text-sm tracking-widest uppercase">
          {randomJoke}
        </p>
      </motion.div>

      {/* Subtle Floating Tech Dots */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-slate-200 rounded-full pointer-events-none"
          initial={{
            x: Math.random() * 100 + '%',
            y: Math.random() * 100 + '%'
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 5
          }}
        />
      ))}
    </div>
  );
};

export default NotFound;
