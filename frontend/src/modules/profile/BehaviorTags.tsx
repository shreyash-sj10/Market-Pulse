import React from "react";

interface BehaviorTagsProps {
  tags: string[];
}

export const BehaviorTags: React.FC<BehaviorTagsProps> = ({ tags }) => {
  return (
    <div className="behavior-tags-section">
      <h3>Identified Patterns</h3>
      <div className="tags-container">
        {tags.length > 0 ? (
          tags.map((tag, i) => (
            <span key={i} className="behavior-tag">
              {tag}
            </span>
          ))
        ) : (
          <span className="no-tags">No patterns identified yet</span>
        )}
      </div>
    </div>
  );
};
