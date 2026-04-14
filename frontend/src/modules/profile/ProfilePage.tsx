import React from "react";
import { ProfileSummary } from "./ProfileSummary";
import { SkillPanel } from "./SkillPanel";
import { BehaviorTags } from "./BehaviorTags";
import { ProfileEmpty } from "./ProfileEmpty";
import { JournalCard } from "../journal/JournalCard";
import { useProfile } from "../../hooks/useProfile";

export const ProfilePage: React.FC = () => {
  const { data, isLoading, isError, error } = useProfile();

  if (isLoading) {
    return <div className="profile-loading">Aggregating behavioral analytics...</div>;
  }

  if (isError) {
    return (
      <div className="profile-error">
        <h3>Analytics Interrupted</h3>
        <p>{error?.message || "Failed to retrieve profile data."}</p>
      </div>
    );
  }

  const profile = data?.data;
  const hasNoTrades = !profile || profile.totalTrades === 0;

  if (hasNoTrades) {
    return <ProfileEmpty />;
  }

  return (
    <div className="profile-page">
      <h1>Personal Intelligence Profile</h1>
      
      <ProfileSummary 
        totalTrades={profile.totalTrades}
        winRate={profile.winRate}
        skillScore={profile.skillScore}
      />

      <div className="detailed-analytics">
        <SkillPanel skillScore={profile.skillScore} />
        <BehaviorTags tags={profile.tags} />
      </div>

      {profile.recentLearning.length > 0 && (
        <section className="recent-learning-section">
          <h2>Recent Learning Reflections</h2>
          <div className="learning-list">
            {profile.recentLearning.map((entry, i) => (
              <JournalCard 
                key={i} 
                symbol={entry.symbol} 
                learning={entry.learningSurface} 
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
