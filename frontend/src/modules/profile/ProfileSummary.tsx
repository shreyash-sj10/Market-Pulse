import React from "react";

interface ProfileSummaryProps {
  totalTrades: number;
  winRate: number;
  skillScore: number;
}

export const ProfileSummary: React.FC<ProfileSummaryProps> = ({ 
  totalTrades, 
  winRate, 
  skillScore 
}) => {
  return (
    <div className="profile-summary">
      <div className="stat-card">
        <label>Total Trades</label>
        <div className="value">{totalTrades}</div>
      </div>
      <div className="stat-card">
        <label>Win Rate</label>
        <div className="value">{winRate}%</div>
      </div>
      <div className="stat-card">
        <label>Skill Score</label>
        <div className="value">{skillScore}</div>
      </div>
    </div>
  );
};
