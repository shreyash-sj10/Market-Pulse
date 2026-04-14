import React from "react";
import { QuotePanel } from "./QuotePanel";
import { NewsList } from "./NewsList";
import { MarketEmpty } from "./MarketEmpty";
import { useMarket } from "../../hooks/useMarket";

export const MarketPage: React.FC = () => {
  const { data, isLoading, isError, error } = useMarket();

  if (isLoading) {
    return <div className="market-loading">Syncing live market data and intelligence...</div>;
  }

  if (isError) {
    return (
      <div className="market-error">
        <h3>Market Connection Interrupted</h3>
        <p>{error?.message || "Failed to retrieve live market context."}</p>
      </div>
    );
  }

  const hasData = data?.success && (data.data.quotes.length > 0 || data.data.news.length > 0);

  if (!hasData) {
    return <MarketEmpty />;
  }

  return (
    <div className="market-page">
      <section className="live-quotes">
        <h2>Market Indices</h2>
        <QuotePanel quotes={data!.data.quotes} />
      </section>

      <section className="market-intelligence">
        <h2>News & Analysis</h2>
        <NewsList news={data!.data.news} />
      </section>
    </div>
  );
};
