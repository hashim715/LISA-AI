import React, { useState, useEffect, useRef } from "react";

const TypewriterText = ({
  texts,
  baseSpeed = 50,
  delayBetweenTexts = 200,
  onComplete = () => {},
}) => {
  const [displayText, setDisplayText] = useState("");
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const previousTextsLengthRef = useRef(0);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);
  const typingJobRef = useRef(null);

  const getDynamicSpeed = (char) => {
    if ([".", "!", "?"].includes(char)) return baseSpeed * 3;
    if ([";", ":", ",", "-"].includes(char)) return baseSpeed * 1.5;
    return baseSpeed;
  };

  // Check if new texts have been added
  useEffect(() => {
    if (!texts || texts.length === 0) {
      setDisplayText("");
      return;
    }

    // Only start typing if we have a new text
    if (texts.length > previousTextsLengthRef.current) {
      // Cancel any current typing job
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Update to the latest text
      const newIndex = texts.length - 1;
      setCurrentTextIndex(newIndex);
      
      // Start typing the new text
      startTypingText(texts[newIndex]);
      
      // Remember the current length of texts array
      previousTextsLengthRef.current = texts.length;
    }
  }, [texts]);

  const startTypingText = (text) => {
    // Create a unique ID for this typing job
    const jobId = Date.now();
    typingJobRef.current = jobId;
    
    let currentIndex = 0;
    setIsTyping(true);
    
    const typeNextChar = () => {
      // Check if this typing job is still current
      if (typingJobRef.current !== jobId) return;
      
      if (currentIndex <= text.length) {
        setDisplayText(text.substring(0, currentIndex));
        const nextChar = text[currentIndex];
        const currentSpeed = nextChar ? getDynamicSpeed(nextChar) : baseSpeed;
        currentIndex++;
        timeoutRef.current = setTimeout(typeNextChar, currentSpeed);
      } else {
        setIsTyping(false);
        onComplete(text, currentTextIndex);
      }
    };
    
    typeNextChar();
  };

  // Auto-scroll to the bottom as text is typed
  useEffect(() => {
    if (containerRef.current && displayText) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [displayText]);

  // Clean up any timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!texts || texts.length === 0) return null;

  return (
    <div
      className="transcript-text"
      ref={containerRef}
      role="region"
      aria-live="polite"
    >
      {displayText}
    </div>
  );
};

export default TypewriterText;