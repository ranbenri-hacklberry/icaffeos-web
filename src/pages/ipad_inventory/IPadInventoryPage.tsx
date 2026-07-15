import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IPadInventory } from '@/pages/ipad_inventory/index';

const IPadInventoryPage: React.FC = () => {
    const navigate = useNavigate();

    const handleExit = () => {
        navigate('/mode-selection');
    };

    return (
        <div className="flex flex-col h-screen bg-transparent overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
                <IPadInventory onExit={handleExit} />
            </div>
        </div>
    );
};

export default IPadInventoryPage;
