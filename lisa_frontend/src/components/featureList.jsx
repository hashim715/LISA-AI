import React, { useState, useEffect } from "react";
import "../styles/featureList.css";

const FeatureList = () => {
  const features = [
    "I can draft and send emails for you",
    "I can set and reschedule meetings for you",
    "I can catch you up on your slack messages",
    "I can tell you whats next on your notion list",
    "I can tell you about new products launched",
    "I can find interesting events for you",
    "I can answer anything, anytime"
  ];
  
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    if (isTyping && !isDeleting) {
      // Typing forward
      if (displayedText.length < features[currentFeatureIndex].length) {
        const timer = setTimeout(() => {
          setDisplayedText(
            features[currentFeatureIndex].substring(0, displayedText.length + 1)
          );
        }, 50); // Increased typing speed (was 100ms)
        return () => clearTimeout(timer);
      } else {
        // Finished typing, pause before deleting
        const timer = setTimeout(() => {
          setIsDeleting(true);
        }, 1500); // Pause at end of typing
        return () => clearTimeout(timer);
      }
    } else if (isDeleting) {
      // Backspace effect
      if (displayedText.length > 0) {
        const timer = setTimeout(() => {
          setDisplayedText(displayedText.substring(0, displayedText.length - 1));
        }, 30); // Backspace speed
        return () => clearTimeout(timer);
      } else {
        // Finished deleting, move to next feature
        const timer = setTimeout(() => {
          setCurrentFeatureIndex((prevIndex) => (prevIndex + 1) % features.length);
          setIsTyping(true);
          setIsDeleting(false);
        }, 500); // Brief pause before next feature
        return () => clearTimeout(timer);
      }
    }
  }, [displayedText, currentFeatureIndex, isTyping, isDeleting, features]);

  return (
    <div className="feature-list">
      <div className="typing-text">
        {displayedText}
        <span className="cursor">|</span>
      </div>
    </div>
  );
};

export default FeatureList;