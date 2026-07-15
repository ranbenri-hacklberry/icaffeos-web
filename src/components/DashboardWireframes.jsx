import React from 'react';

// קופה רושמת וינטג'ית מפורטת - Detailed Vintage Cash Register Outline
export const VintageCashRegister = ({ className = "" }) => (
    <svg
        viewBox="0 0 340 360"
        className={`absolute pointer-events-none ${className}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {/* ====== ORNAMENTAL TOP CROWN ====== */}
        {/* Main crown arch */}
        <path d="M 95 62 Q 95 28, 130 25 L 210 25 Q 245 28, 245 62" strokeWidth="1.5" />
        {/* Inner decorative arch */}
        <path d="M 105 62 Q 105 38, 135 35 L 205 35 Q 235 38, 235 62" opacity="0.4" />
        {/* Crown finial */}
        <path d="M 165 25 L 170 12 L 175 25" strokeWidth="1" opacity="0.6" />
        <circle cx="170" cy="10" r="3" opacity="0.5" />
        {/* Side scrollwork left */}
        <path d="M 95 55 Q 80 50, 78 62 Q 76 72, 88 68" opacity="0.35" strokeWidth="1" />
        {/* Side scrollwork right */}
        <path d="M 245 55 Q 260 50, 262 62 Q 264 72, 252 68" opacity="0.35" strokeWidth="1" />

        {/* ====== PRICE DISPLAY WINDOW ====== */}
        {/* Outer frame with rounded corners */}
        <rect x="100" y="58" width="140" height="50" rx="8" ry="8" strokeWidth="1.5" />
        {/* Inner glass panel */}
        <rect x="108" y="65" width="124" height="36" rx="4" ry="4" opacity="0.5" />
        {/* Price readout digits */}
        <text x="170" y="90" fontSize="18" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="currentColor" opacity="0.55">₪ 42.50</text>
        {/* Small indicator dots on display frame */}
        <circle cx="112" cy="62" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="228" cy="62" r="1.5" fill="currentColor" opacity="0.3" />

        {/* ====== MAIN BODY ====== */}
        {/* Outer shell - elegant curved shape */}
        <path d="M 70 108 L 70 240 Q 70 248, 78 248 L 262 248 Q 270 248, 270 240 L 270 108 Q 270 102, 262 102 L 78 102 Q 70 102, 70 108 Z" strokeWidth="1.5" />
        {/* Decorative line under display */}
        <line x1="80" y1="115" x2="260" y2="115" opacity="0.3" />

        {/* ====== ROUND KEY ROWS (Typewriter-style) ====== */}
        {/* Row 1 - Top number keys */}
        {[0, 1, 2, 3, 4].map((i) => (
            <g key={`r1-${i}`} transform={`translate(${105 + i * 32}, 132)`}>
                <circle r="11" strokeWidth="1.2" />
                <circle r="8" opacity="0.25" />
                <text y="4" fontSize="9" fontWeight="bold" textAnchor="middle" fill="currentColor" opacity="0.5">
                    {[7, 8, 9, 0, '•'][i]}
                </text>
            </g>
        ))}

        {/* Row 2 - Middle keys */}
        {[0, 1, 2, 3, 4].map((i) => (
            <g key={`r2-${i}`} transform={`translate(${105 + i * 32}, 162)`}>
                <circle r="11" strokeWidth="1.2" />
                <circle r="8" opacity="0.25" />
                <text y="4" fontSize="9" fontWeight="bold" textAnchor="middle" fill="currentColor" opacity="0.5">
                    {[4, 5, 6, '₪', '+'][i]}
                </text>
            </g>
        ))}

        {/* Row 3 - Bottom keys */}
        {[0, 1, 2, 3, 4].map((i) => (
            <g key={`r3-${i}`} transform={`translate(${105 + i * 32}, 192)`}>
                <circle r="11" strokeWidth="1.2" />
                <circle r="8" opacity="0.25" />
                <text y="4" fontSize="9" fontWeight="bold" textAnchor="middle" fill="currentColor" opacity="0.5">
                    {[1, 2, 3, 'C', '='][i]}
                </text>
            </g>
        ))}

        {/* Decorative band below keys */}
        <line x1="80" y1="212" x2="260" y2="212" opacity="0.25" />
        <line x1="80" y1="215" x2="260" y2="215" opacity="0.15" />

        {/* ====== RECEIPT SLOT ====== */}
        <rect x="145" y="220" width="50" height="6" rx="2" opacity="0.5" />
        {/* Receipt paper peeking out */}
        <path d="M 155 220 L 155 210 Q 157 206, 160 210 L 162 214 Q 164 218, 166 214 L 168 210 Q 170 206, 172 210 L 172 220" opacity="0.3" strokeWidth="0.8" />

        {/* ====== CASH DRAWER ====== */}
        {/* Outer drawer */}
        <rect x="58" y="252" width="224" height="48" rx="6" ry="6" strokeWidth="1.5" />
        {/* Drawer panel lines */}
        <rect x="68" y="258" width="204" height="36" rx="3" ry="3" opacity="0.25" />
        {/* Drawer handle */}
        <rect x="140" y="270" width="60" height="12" rx="6" ry="6" strokeWidth="1.2" />
        <line x1="152" y1="276" x2="188" y2="276" opacity="0.3" />
        {/* Ornamental drawer keyhole */}
        <circle cx="125" cy="276" r="4" opacity="0.35" />
        <line x1="125" y1="278" x2="125" y2="283" opacity="0.3" strokeWidth="1" />

        {/* ====== DECORATIVE SIDE LEVER (Right) ====== */}
        <g>
            {/* Lever arm */}
            <path d="M 270 130 Q 285 128, 290 120 L 295 100 Q 298 90, 295 82" strokeWidth="1.8" />
            {/* Lever handle (round knob) */}
            <circle cx="295" cy="78" r="10" strokeWidth="1.5" />
            <circle cx="295" cy="78" r="6" opacity="0.3" />
            <circle cx="295" cy="78" r="3" fill="currentColor" opacity="0.2" />
            {/* Lever pivot point */}
            <circle cx="272" cy="130" r="4" opacity="0.4" />
        </g>

        {/* ====== DECORATIVE FEET ====== */}
        <path d="M 65 300 Q 58 300, 55 310 Q 54 315, 60 316 L 80 316 Q 86 316, 85 310 Q 83 304, 78 302" opacity="0.4" />
        <path d="M 275 300 Q 282 300, 285 310 Q 286 315, 280 316 L 260 316 Q 254 316, 255 310 Q 257 304, 262 302" opacity="0.4" />
        {/* Center foot */}
        <path d="M 155 300 Q 155 312, 165 314 L 175 314 Q 185 312, 185 300" opacity="0.25" />

        {/* ====== SUBTLE EMBELLISHMENTS ====== */}
        {/* Corner ornaments on body */}
        <path d="M 78 108 Q 78 104, 82 104" opacity="0.3" strokeWidth="0.8" />
        <path d="M 262 108 Q 262 104, 258 104" opacity="0.3" strokeWidth="0.8" />
        {/* Side rivet details */}
        <circle cx="78" cy="150" r="2" opacity="0.2" fill="currentColor" />
        <circle cx="78" cy="175" r="2" opacity="0.2" fill="currentColor" />
        <circle cx="78" cy="200" r="2" opacity="0.2" fill="currentColor" />
        <circle cx="262" cy="150" r="2" opacity="0.2" fill="currentColor" />
        <circle cx="262" cy="175" r="2" opacity="0.2" fill="currentColor" />
        <circle cx="262" cy="200" r="2" opacity="0.2" fill="currentColor" />
    </svg>
);

// בונים תלויים על מסילה במטבח - Detailed Kitchen Order Tickets
export const RestaurantTickets = ({ className = "" }) => (
    <svg
        viewBox="0 0 340 340"
        className={`absolute pointer-events-none ${className}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {/* ====== MOUNTING BRACKET ====== */}
        {/* Wall mount screws */}
        <circle cx="30" cy="22" r="3" opacity="0.3" />
        <circle cx="30" cy="22" r="1.5" fill="currentColor" opacity="0.2" />
        <circle cx="310" cy="22" r="3" opacity="0.3" />
        <circle cx="310" cy="22" r="1.5" fill="currentColor" opacity="0.2" />

        {/* ====== RAIL / CLIP WIRE ====== */}
        {/* Main heavy rail */}
        <line x1="20" y1="30" x2="320" y2="30" strokeWidth="3" />
        {/* Secondary thin rail */}
        <line x1="20" y1="36" x2="320" y2="36" strokeWidth="1.5" opacity="0.5" />
        {/* Rail end caps */}
        <rect x="15" y="26" width="10" height="14" rx="2" opacity="0.4" />
        <rect x="315" y="26" width="10" height="14" rx="2" opacity="0.4" />

        {/* ====== CLIPS ====== */}
        {/* Clip 1 */}
        <g transform="translate(55, 28)">
            <path d="M -6 0 L -6 10 L -3 14 L 3 14 L 6 10 L 6 0" strokeWidth="1.5" />
            <line x1="-4" y1="4" x2="4" y2="4" opacity="0.4" />
        </g>
        {/* Clip 2 */}
        <g transform="translate(140, 28)">
            <path d="M -6 0 L -6 10 L -3 14 L 3 14 L 6 10 L 6 0" strokeWidth="1.5" />
            <line x1="-4" y1="4" x2="4" y2="4" opacity="0.4" />
        </g>
        {/* Clip 3 */}
        <g transform="translate(225, 28)">
            <path d="M -6 0 L -6 10 L -3 14 L 3 14 L 6 10 L 6 0" strokeWidth="1.5" />
            <line x1="-4" y1="4" x2="4" y2="4" opacity="0.4" />
        </g>

        {/* ====== TICKET 1 (Tall - Active Order) ====== */}
        <g>
            {/* Paper body with slight rotation for naturalism */}
            <g transform="rotate(-2, 55, 42)">
                <rect x="25" y="42" width="65" height="210" rx="2" />
                {/* Perforated top edge */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                    <circle key={`perf1-${i}`} cx={30 + i * 5} cy="47" r="1" opacity="0.3" fill="currentColor" />
                ))}
                {/* Header line */}
                <line x1="32" y1="56" x2="83" y2="56" strokeWidth="0.8" opacity="0.4" />
                {/* Order number */}
                <text x="57" y="72" fontSize="12" fontWeight="900" textAnchor="middle" fill="currentColor" opacity="0.6" fontFamily="monospace">#042</text>
                {/* Time */}
                <text x="57" y="84" fontSize="7" textAnchor="middle" fill="currentColor" opacity="0.35" fontFamily="monospace">14:32</text>
                {/* Divider */}
                <line x1="32" y1="90" x2="83" y2="90" strokeDasharray="3,2" opacity="0.3" />

                {/* Order items text lines */}
                <line x1="32" y1="102" x2="82" y2="102" opacity="0.35" strokeWidth="1.5" />
                <line x1="32" y1="114" x2="75" y2="114" opacity="0.3" strokeWidth="1" />
                <line x1="38" y1="124" x2="72" y2="124" opacity="0.2" strokeWidth="0.8" />

                <line x1="32" y1="140" x2="80" y2="140" opacity="0.35" strokeWidth="1.5" />
                <line x1="32" y1="152" x2="68" y2="152" opacity="0.3" strokeWidth="1" />

                <line x1="32" y1="168" x2="78" y2="168" opacity="0.35" strokeWidth="1.5" />
                <line x1="32" y1="180" x2="72" y2="180" opacity="0.3" strokeWidth="1" />
                <line x1="38" y1="190" x2="65" y2="190" opacity="0.2" strokeWidth="0.8" />

                {/* Divider before checkmarks */}
                <line x1="32" y1="205" x2="83" y2="205" strokeDasharray="3,2" opacity="0.3" />

                {/* Checkboxes with checks */}
                <rect x="33" y="212" width="9" height="9" rx="1.5" opacity="0.35" />
                <polyline points="35,217 37,219.5 41,214" strokeWidth="1.5" opacity="0.55" />
                <line x1="47" y1="217" x2="78" y2="217" opacity="0.25" strokeWidth="1" />

                <rect x="33" y="226" width="9" height="9" rx="1.5" opacity="0.35" />
                <polyline points="35,231 37,233.5 41,228" strokeWidth="1.5" opacity="0.55" />
                <line x1="47" y1="231" x2="72" y2="231" opacity="0.25" strokeWidth="1" />

                <rect x="33" y="240" width="9" height="9" rx="1.5" opacity="0.35" />
                <line x1="47" y1="245" x2="75" y2="245" opacity="0.25" strokeWidth="1" />
            </g>
        </g>

        {/* ====== TICKET 2 (Tallest - Long Order) ====== */}
        <g>
            <g transform="rotate(1, 140, 42)">
                <rect x="108" y="42" width="65" height="240" rx="2" />
                {/* Perforated top edge */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                    <circle key={`perf2-${i}`} cx={113 + i * 5} cy="47" r="1" opacity="0.3" fill="currentColor" />
                ))}
                {/* Header */}
                <line x1="115" y1="56" x2="166" y2="56" strokeWidth="0.8" opacity="0.4" />
                <text x="140" y="72" fontSize="12" fontWeight="900" textAnchor="middle" fill="currentColor" opacity="0.6" fontFamily="monospace">#043</text>
                <text x="140" y="84" fontSize="7" textAnchor="middle" fill="currentColor" opacity="0.35" fontFamily="monospace">14:35</text>
                <line x1="115" y1="90" x2="166" y2="90" strokeDasharray="3,2" opacity="0.3" />

                {/* Many items - longer ticket */}
                <line x1="115" y1="102" x2="165" y2="102" opacity="0.35" strokeWidth="1.5" />
                <line x1="115" y1="114" x2="158" y2="114" opacity="0.3" strokeWidth="1" />

                <line x1="115" y1="130" x2="162" y2="130" opacity="0.35" strokeWidth="1.5" />
                <line x1="115" y1="142" x2="150" y2="142" opacity="0.3" strokeWidth="1" />
                <line x1="121" y1="152" x2="155" y2="152" opacity="0.2" strokeWidth="0.8" />

                <line x1="115" y1="168" x2="160" y2="168" opacity="0.35" strokeWidth="1.5" />
                <line x1="115" y1="180" x2="155" y2="180" opacity="0.3" strokeWidth="1" />

                <line x1="115" y1="196" x2="163" y2="196" opacity="0.35" strokeWidth="1.5" />
                <line x1="115" y1="208" x2="152" y2="208" opacity="0.3" strokeWidth="1" />
                <line x1="121" y1="218" x2="148" y2="218" opacity="0.2" strokeWidth="0.8" />

                <line x1="115" y1="234" x2="158" y2="234" opacity="0.35" strokeWidth="1.5" />
                <line x1="115" y1="246" x2="145" y2="246" opacity="0.3" strokeWidth="1" />

                {/* Bottom divider */}
                <line x1="115" y1="258" x2="166" y2="258" strokeDasharray="3,2" opacity="0.3" />

                {/* Checkboxes */}
                <rect x="116" y="264" width="9" height="9" rx="1.5" opacity="0.35" />
                <line x1="130" y1="269" x2="162" y2="269" opacity="0.25" strokeWidth="1" />
            </g>
        </g>

        {/* ====== TICKET 3 (Short - Quick Order, slightly done) ====== */}
        <g>
            <g transform="rotate(-1, 225, 42)">
                <rect x="195" y="42" width="65" height="170" rx="2" />
                {/* Perforated top edge */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                    <circle key={`perf3-${i}`} cx={200 + i * 5} cy="47" r="1" opacity="0.3" fill="currentColor" />
                ))}
                {/* Header */}
                <line x1="202" y1="56" x2="253" y2="56" strokeWidth="0.8" opacity="0.4" />
                <text x="227" y="72" fontSize="12" fontWeight="900" textAnchor="middle" fill="currentColor" opacity="0.6" fontFamily="monospace">#044</text>
                <text x="227" y="84" fontSize="7" textAnchor="middle" fill="currentColor" opacity="0.35" fontFamily="monospace">14:38</text>
                <line x1="202" y1="90" x2="253" y2="90" strokeDasharray="3,2" opacity="0.3" />

                {/* Fewer items */}
                <line x1="202" y1="102" x2="250" y2="102" opacity="0.35" strokeWidth="1.5" />
                <line x1="202" y1="114" x2="242" y2="114" opacity="0.3" strokeWidth="1" />

                <line x1="202" y1="130" x2="248" y2="130" opacity="0.35" strokeWidth="1.5" />
                <line x1="202" y1="142" x2="235" y2="142" opacity="0.3" strokeWidth="1" />

                {/* Divider */}
                <line x1="202" y1="158" x2="253" y2="158" strokeDasharray="3,2" opacity="0.3" />

                {/* All checked - done! */}
                <rect x="203" y="165" width="9" height="9" rx="1.5" opacity="0.35" />
                <polyline points="205,170 207,172.5 211,167" strokeWidth="1.5" opacity="0.55" />
                <line x1="217" y1="170" x2="248" y2="170" opacity="0.25" strokeWidth="1" />

                <rect x="203" y="180" width="9" height="9" rx="1.5" opacity="0.35" />
                <polyline points="205,185 207,187.5 211,182" strokeWidth="1.5" opacity="0.55" />
                <line x1="217" y1="185" x2="245" y2="185" opacity="0.25" strokeWidth="1" />

                <rect x="203" y="195" width="9" height="9" rx="1.5" opacity="0.35" />
                <polyline points="205,200 207,202.5 211,197" strokeWidth="1.5" opacity="0.55" />
                <line x1="217" y1="200" x2="240" y2="200" opacity="0.25" strokeWidth="1" />
            </g>
        </g>

        {/* ====== PARTIAL TICKET 4 (peeking from right edge) ====== */}
        <g opacity="0.45">
            <g transform="rotate(2, 305, 42)">
                <rect x="280" y="42" width="50" height="140" rx="2" />
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                    <circle key={`perf4-${i}`} cx={285 + i * 5} cy="47" r="1" opacity="0.3" fill="currentColor" />
                ))}
                <text x="305" y="72" fontSize="11" fontWeight="900" textAnchor="middle" fill="currentColor" opacity="0.5" fontFamily="monospace">#045</text>
                <line x1="287" y1="90" x2="325" y2="90" strokeDasharray="3,2" opacity="0.25" />
                <line x1="287" y1="102" x2="322" y2="102" opacity="0.3" strokeWidth="1.2" />
                <line x1="287" y1="114" x2="315" y2="114" opacity="0.25" strokeWidth="1" />
                <line x1="287" y1="130" x2="320" y2="130" opacity="0.3" strokeWidth="1.2" />
                <line x1="287" y1="142" x2="310" y2="142" opacity="0.25" strokeWidth="1" />
            </g>
        </g>

        {/* ====== AMBIENT DETAIL: Steam/Heat lines above ====== */}
        <path d="M 60 18 Q 63 8, 58 2" opacity="0.12" strokeWidth="1" />
        <path d="M 280 15 Q 283 5, 278 0" opacity="0.1" strokeWidth="1" />
    </svg>
);

// Aliases for backward compatibility
export const PosWireframe = VintageCashRegister;
export const KdsWireframe = RestaurantTickets;
