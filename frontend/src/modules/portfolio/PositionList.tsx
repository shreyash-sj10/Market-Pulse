import React from "react";
import { PositionCard } from "./PositionCard";
import type { PortfolioPosition } from "../../contracts/portfolio";

interface PositionListProps {
  positions: PortfolioPosition[];
}

export const PositionList: React.FC<PositionListProps> = ({ positions }) => {
  if (positions.length === 0) {
    return (
      <div className="empty-positions">
        <p>NO ACTIVE POSITIONS</p>
      </div>
    );
  }

  return (
    <div className="position-list">
      {positions.map((pos) => (
        <PositionCard key={pos.symbol} position={pos} />
      ))}
    </div>
  );
};
