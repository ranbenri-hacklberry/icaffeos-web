import React from 'react';
import { motion } from 'framer-motion';

const HeroCard = ({
    title,
    subtitle,
    icon: Icon,
    Pattern,
    gradient,
    delay = 0,
    stats,
    onClick,
    compact = false
}) => {
    return (
        <motion.div
            // 1. כניסה חלקה (Entrance Only) - Removed 'y' to prevent screen jumping
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay }}

            // 2. פידבק טקטילי לטאבלט (Touch Feedback Only)
            whileTap={{ scale: 0.98 }}

            onClick={onClick}
            className={`relative ${compact ? 'h-32 sm:h-40' : 'h-48 sm:h-64'} rounded-[2rem] overflow-hidden cursor-pointer shadow-lg ${gradient}`}
        >
            {/* 3. רקע דקורטיבי: Wireframe SVG */}
            <div className="absolute -top-4 right-0 w-full h-full opacity-30 text-white rotate-[-8deg] scale-[1.3] translate-x-6 translate-y-4 transition-all duration-700">
                {Pattern && <Pattern className="w-full h-full" />}
            </div>

            {/* 4. רעש עדין לטקסטורה */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

            {/* 5. התוכן (Z-Indexed Container) */}
            <div className="relative z-10 h-full p-6 flex flex-col justify-between" dir="rtl">

                {/* חלק עליון: אייקון וסטטוס */}
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-white/20 backdrop-blur-xl border border-white/20 rounded-full shadow-inner">
                        <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>

                    {stats && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="px-3 py-1 bg-black/20 backdrop-blur-md rounded-full border border-white/10"
                        >
                            <span className="text-[10px] font-bold text-white/90 flex items-center gap-1.5 uppercase tracking-tighter">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                {stats}
                            </span>
                        </motion.div>
                    )}
                </div>

                {/* חלק תחתון: טקסטים גדולים וברורים */}
                <div>
                    <h2 className={`${compact ? 'text-xl sm:text-2xl' : 'text-4xl'} font-black text-white leading-tight drop-shadow-lg`}>
                        {title}
                    </h2>
                    <p className={`${compact ? 'text-sm' : 'text-lg'} text-white/80 font-bold mt-1`}>
                        {subtitle}
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default HeroCard;
