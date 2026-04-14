import React from "react";
import type { MarketNews } from "../../contracts/market";

interface NewsCardProps {
  news: MarketNews;
}

export const NewsCard: React.FC<NewsCardProps> = ({ news }) => {
  const { title, ai } = news;

  return (
    <div className="news-card">
      <h3 className="news-title">{title}</h3>
      
      <div className="ai-intelligence">
        {ai.status === "OK" ? (
          <div className="ai-content">
            <p className="summary">{ai.explanation.summary}</p>
            {ai.explanation.warnings.length > 0 && (
              <div className="warnings">
                <strong>Warnings:</strong>
                <ul>
                  {ai.explanation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {ai.explanation.keyFactors.length > 0 && (
              <div className="key-factors">
                <strong>Key Factors:</strong>
                <ul>
                  {ai.explanation.keyFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="unavailable">Analysis unavailable</p>
        )}
      </div>
    </div>
  );
};
