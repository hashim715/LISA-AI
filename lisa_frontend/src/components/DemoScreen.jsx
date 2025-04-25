import React, { useState, useCallback, useRef, useEffect } from "react";
import "../styles/main.css";
import TypewriterText from "./TypewriterText";
import { useConversation } from "@11labs/react";
import defaultVideo from "../assets/animation.mp4";
import listeningVideo from "../assets/main_animation.mp4";
import { useNavigate } from "react-router-dom";
import MuteButton from "./MuteButton";
import EndCallButton from "./EndCallButton";
import FeatureList from "./featureList";
import Footer from "./footer";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useOnline from "../hooks/useOnline";

const DemoScreen = () => {
  const [isThinking, setIsThinking] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const audioContextRef = useRef(null);
  const agentId = import.meta.env.VITE_DEMO_AGENT_ID;
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isOnline, hasInternet } = useOnline();

  const conversation = useConversation({
    micMuted: isMicMuted,
    onConnect: () => {
      console.log("Connected to WebSocket");
    },
    onDisconnect: () => {
      console.log("Disconnected from WebSocket");
      setIsThinking(false);
      setIsMicMuted(false);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setTranscripts([]);
    },
    onMessage: (message) => {
      handleMessage(message);
    },
    onError: (error) => {
      console.log("WebSocket Error:", error);
      setIsMicMuted(false);
      setIsThinking(false);
      setTranscripts([]);
    },
  });

  const handleMessage = (message) => {
    if (message && message.source === "ai") {
      setTranscripts((prev) => [...prev, message.message]);
      setIsThinking(false);
    } else if (message && message.source === "user") {
      setIsThinking(true);
    }
  };

  const startConversation = useCallback(async () => {
    setCallStarted(true);
    try {
      if (
        conversation.status === "connected" ||
        conversation.status === "connecting"
      ) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      await conversation.startSession({
        agentId: agentId,
      });
    } catch (error) {
      // console.log("Error starting conversation:", error);
      // if (error.name === "NotAllowedError") {
      //   alert(
      //     "Microphone access was denied. Please allow microphone access in your browser settings."
      //   );
      // } else {
      //   alert("Failed to start conversation. Please try again.");
      // }
      setCallStarted(false);
    }
  }, [conversation, agentId]);

  const stopConversation = useCallback(async () => {
    try {
      if (conversation.status !== "connected") {
        return;
      }

      await conversation.endSession();

      setIsMicMuted(false);
      setIsThinking(false);
      setTranscripts([]);
    } catch (error) {
      console.log("Error stopping conversation:", error);
    }
  }, [conversation]);

  const startRecording = () => {
    startConversation();
  };

  const stopRecording = () => {
    stopConversation();
  };

  const handleComplete = (completedText, index) => {
    // Handle transcript completion if needed
  };

  const handleSignIn = () => {
    navigate("/login");
  };

  if (!isOnline) return <p>No Network..</p>;

  if (!hasInternet) return <p>No internet access...</p>;

  if (loading) return <p>Loading...</p>;

  return user ? (
    <Navigate to="/main" />
  ) : (
    <div className="container">
      <div className="company-name">Lisa</div>

      <div className="signin-button" onClick={handleSignIn}>
        Log in or Sign up
      </div>

      {conversation.status === "connected" ||
      conversation.status === "connecting" ? (
        <>
          {conversation.isSpeaking ? (
            <div></div>
          ) : isThinking ? (
            <div className="listening-button">Thinking...</div>
          ) : (
            <div className="listening-button">Listening...</div>
          )}

          <div className="video-container">
            <video
              key={callStarted ? "listening" : "default"}
              autoPlay
              loop
              muted
              playsInline
            >
              <source
                src={callStarted ? listeningVideo : defaultVideo}
                type="video/mp4"
              />
            </video>
          </div>

          {transcripts.length > 0 && (
            <div className="transcript-container">
              <TypewriterText
                texts={transcripts}
                speed={50}
                delayBetweenTexts={1000}
                onComplete={handleComplete}
              />
            </div>
          )}
          <div className="call-controls">
            <MuteButton
              isMuted={isMicMuted}
              onClick={() => {
                setIsMicMuted((prev) => {
                  const newMutedState = !prev;
                  return newMutedState;
                });
              }}
            />

            <EndCallButton onClick={stopRecording} />
          </div>
        </>
      ) : (
        <>
          <FeatureList />
          <div className="heading">What can I do for you today?</div>
          <div className="video-container">
            <video
              key={callStarted ? "listening" : "default"}
              autoPlay
              loop
              muted
              playsInline
            >
              <source
                src={callStarted ? listeningVideo : defaultVideo}
                type="video/mp4"
              />
            </video>
          </div>

          <button
            className="start-button"
            onClick={startRecording}
            onTouchEnd={startRecording}
          >
            Press to start
          </button>
        </>
      )}

      <Footer />
    </div>
  );
};

export default DemoScreen;
