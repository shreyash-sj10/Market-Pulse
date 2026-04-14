import React from "react";
import { NewsCard } from "./NewsCard";
import type { MarketNews } from "../../contracts/market";

interface NewsListProps {
  news: MarketNews[];
}

export const NewsList: React.FC<NewsListProps> = ({ news }) => {
  return (
    <div className="news-list">
      {news.map((n, i) => (
        <NewsCard key={`${n.title}-${i}`} news={n} />
      ))}
    </div>
  );
};
