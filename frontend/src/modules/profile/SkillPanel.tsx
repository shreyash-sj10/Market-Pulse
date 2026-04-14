import React from "react";

interface SkillPanelProps {
  skillScore: number;
}

export const SkillPanel: React.FC<SkillPanelProps> = ({ skillScore }) => {
  return (
    <div className="skill-panel">
      <h3>Institutional Proficiency</h3>
      <div className="score-display">
        <span className="big-number">{skillScore}</span>
        <span className="unit">/ 100</span>
      </div>
      <p className="note">Calculated aggregate of discipline, consistency, and risk management adherence.</p>
    </div>
  );
};
