
// Minimal mock for heavy libraries in LITE mode
// Framer Motion
export const motion = {
    div: 'div',
    span: 'span',
    p: 'p',
    button: 'button',
    section: 'section',
    li: 'li',
    ul: 'ul',
    img: 'img',
    a: 'a',
    svg: 'svg',
    path: 'path'
};

export const AnimatePresence = ({ children }) => <>{children}</>;
export const LayoutGroup = ({ children }) => <>{children}</>;

// Recharts mocks
export const ResponsiveContainer = ({ children }) => <div style={{ width: '100%', height: '100%' }}>{children}</div>;
export const BarChart = () => null;
export const LineChart = () => null;
export const PieChart = () => null;
export const Cell = () => null;
export const XAxis = () => null;
export const YAxis = () => null;
export const Tooltip = () => null;
export const Legend = () => null;
export const Bar = () => null;
export const Line = () => null;
export const Pie = () => null;
export const CartesianGrid = () => null;
