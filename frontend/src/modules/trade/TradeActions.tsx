import React from "react";

interface TradeActionsProps {
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
  canExecute: boolean;
}

export const TradeActions: React.FC<TradeActionsProps> = ({
  onConfirm,
  onCancel,
  isExecuting,
  canExecute,
}) => {
  return (
    <div className="trade-actions">
      <button 
        onClick={onCancel} 
        disabled={isExecuting}
        className="btn-secondary"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={!canExecute || isExecuting}
        className="btn-primary"
      >
        {isExecuting ? "Executing..." : "Confirm Execution"}
      </button>
    </div>
  );
};
