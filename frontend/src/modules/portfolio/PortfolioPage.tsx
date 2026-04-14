import React from "react";
import { PortfolioSummary } from "./PortfolioSummary";
import { PositionList } from "./PositionList";
import { usePortfolioSummary, usePortfolioPositions } from "../../hooks/usePortfolio";

export const PortfolioPage: React.FC = () => {
  const summaryQuery = usePortfolioSummary();
  const positionsQuery = usePortfolioPositions();

  const isLoading = summaryQuery.isLoading || positionsQuery.isLoading;
  const isError = summaryQuery.isError || positionsQuery.isError;
  const error = summaryQuery.error || positionsQuery.error;

  if (isLoading) {
    return <div className="portfolio-loading">Syncing portfolio data...</div>;
  }

  if (isError) {
    return (
      <div className="portfolio-error">
        <h3>Communication Failure</h3>
        <p>{error?.message || "Failed to retrieve portfolio state."}</p>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <h1>Financial Overview</h1>
      
      {summaryQuery.data?.success && (
        <PortfolioSummary summary={summaryQuery.data.data} />
      )}

      <div className="holdings-section">
        <h2>Active Positions</h2>
        {positionsQuery.data?.success && (
          <PositionList positions={positionsQuery.data.data} />
        )}
      </div>
    </div>
  );
};
