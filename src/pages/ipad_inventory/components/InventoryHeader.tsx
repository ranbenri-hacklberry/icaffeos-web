import React from 'react';
import { ClipboardList, Truck, FileText } from 'lucide-react';
import UnifiedHeader from '@/components/UnifiedHeader';

interface InventoryHeaderProps {
    activeTab: 'counts' | 'shipping';
    setActiveTab: (tab: 'counts' | 'shipping') => void;
    onExit: () => void;
    onShowReport: () => void;
    shortagesCount: number;
}

const InventoryHeader: React.FC<InventoryHeaderProps> = ({ activeTab, setActiveTab, onExit, onShowReport, shortagesCount }) => {
    return (
        <UnifiedHeader
            title="ניהול מלאי"
            subtitle="ספירה וקבלת סחורה"
            onHome={onExit}
            headerTabs={[
                { id: 'counts', label: 'ספירה', icon: <ClipboardList size={16} />, isActive: activeTab === 'counts', onClick: () => setActiveTab('counts'), colorClass: 'text-indigo-600' },
                { id: 'shipping', label: 'קבלת סחורה', icon: <Truck size={16} />, isActive: activeTab === 'shipping', onClick: () => setActiveTab('shipping'), colorClass: 'text-indigo-600' }
            ]}
            leftTabContent={
                activeTab === 'counts' ? (
                    <button
                        onClick={onShowReport}
                        className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 h-9 md:h-10 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all shadow-sm border border-rose-100/50 active:scale-95 relative"
                    >
                        <FileText size={16} />
                        <span>דווח חוסרים</span>
                        {shortagesCount > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full font-black shadow-sm absolute -top-1.5 -left-1.5 border-2 border-white tabular-nums leading-none">
                                {shortagesCount}
                            </span>
                        )}
                    </button>
                ) : undefined
            }
        />
    );
};

export default InventoryHeader;
