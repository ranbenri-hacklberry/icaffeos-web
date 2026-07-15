import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IPadInventory } from '@/pages/ipad_inventory';

const InventoryPage = () => {
    const navigate = useNavigate();

    const handleExit = () => {
        navigate('/mode-selection');
    };

    return (
        <IPadInventory onExit={handleExit} />
    );
};

export default InventoryPage;
