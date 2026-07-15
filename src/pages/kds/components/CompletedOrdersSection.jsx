import React from 'react';
import OrderCard from '@/pages/kds/components/OrderCard';

const CompletedOrdersSection = ({ completedOrders = [], onMarkDelivered, onPaymentCollected }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1">
        {completedOrders?.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">אין הזמנות שהושלמו</p>
          </div>
        ) : (
          <div className="flex h-full flex-row-reverse justify-end gap-[5px] overflow-x-auto overflow-y-hidden whitespace-nowrap pb-4">
            {completedOrders?.map((order) => (
              <div key={order?.id} className="flex-shrink-0">
                <OrderCard
                  order={order}
                  onOrderStatusUpdate={(orderId) => onMarkDelivered?.(orderId)}
                  onPaymentCollected={onPaymentCollected}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedOrdersSection;