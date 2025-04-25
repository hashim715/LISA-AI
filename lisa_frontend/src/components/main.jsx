import React, { useEffect, useState, useCallback, useRef } from "react";
import "../styles/main.css";
import TypewriterText from "./TypewriterText";
import { useConversation } from "@11labs/react";
import { useSelector } from "react-redux";
import useAxios from "../utils/useAxios";
import defaultVideo from "../assets/animation.mp4";
import listeningVideo from "../assets/main_animation.mp4";
import useAuth from "../hooks/useAuth";
import { new_user_system_prompt } from "../constants/constants";
import { useNavigate } from "react-router-dom";
import MuteButton from "./MuteButton";
import EndCallButton from "./EndCallButton";
import FeatureList from "./featureList";
import Footer from "./footer";
import closeicon from "../assets/close.png";
import { useDispatch } from "react-redux";
import { fetchUser } from "../store/reducer/auth-slice";

const Main = () => {
  const micStreamRef = useRef(null);
  const [transcripts, setTranscripts] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const audioContextRef = useRef(null);
  const baseURL = useSelector((state) => state.baseUrl.url);
  const api = useAxios();
  const { user, loading } = useAuth();
  const [phoneNumberProvided, setPhoneNumberProvided] = useState(
    user.phone_number ? true : false
  );
  const agentId = import.meta.env.VITE_AGENT_ID;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const conversation = useConversation({
    micMuted: isMicMuted,
    onConnect: () => {
      console.log("Connected to WebSocket");
    },
    onDisconnect: async () => {
      // Stop all tracks in the conversation's media stream
      if (conversation.mediaStream) {
        conversation.mediaStream.getTracks().forEach(track => track.stop());
      }
      
      // Stop the original microphone stream tracks
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        micStreamRef.current = null;
      }
      console.log("Disconnected from WebSocket");

      setIsThinking(false);
      setIsMicMuted(false);
      setTranscripts([]);
      dispatch(fetchUser(baseURL));
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    },
    onMessage: (message) => {
      handleMessage(message);
    },
    onError: async (error) => {
      console.log("WebSocket Error:", error);
      setTranscripts([]);
      setIsMicMuted(false);
      setIsThinking(false);
      dispatch(fetchUser(baseURL));
      if (conversation.mediaStream) {
        conversation.mediaStream.getTracks().forEach(track => track.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        micStreamRef.current = null;
      }
    },
  });

  const handleMessage = (message) => {
    if (message && message.source === "ai") {
      console.log("message from ai", message.message);
      setTranscripts((prev) => [...prev, message.message]);
      setIsThinking(false);
    } else if (message && message.source === "user") {
      setIsThinking(true);
      console.log("message from user", message.message);
    }
  };

  const handleClosePopup = () => {
    setPhoneNumberProvided(true);
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
      micStreamRef.current = stream;
      await conversation.startSession({
        agentId: agentId,
        dynamicVariables: {
          user_name: user.name,
          user_token: user.token,
          token: user.token,
          user: JSON.stringify(user),
          email_connected:
            user.google_login && user.outlook_login
              ? "Google and Outlook both connected"
              : user.google_login && !user.outlook_login
              ? "Only Google connected"
              : user.outlook_login && !user.google_login
              ? "Only Outlook connected"
              : "No emails connected",
          first_message: !user.preferences_added
            ? "Hey, I am Lisa and you are?"
            : !user.morning_update_check
            ? "Good morning, ready for the morning update?"
            : "Hi, How can I help you today?",
          system_prompt: !user.preferences_added
            ? new_user_system_prompt
            : !user.morning_update_check
            ? "You are an AI voice assistant named Lisa. Your job is to understand the morning briefings by accessing data from the tools and then come up with a short summary of what's important. Using the Morning_Update tool to get the morning update for the user. If the user declines to receive the morning update, use the Finish_Update tool."
            : "You are an AI voice assistant named Lisa. Your job is to use the provided tools to answer the user's question and perform the action requested.",
        },
      });
    } catch (error) {
      console.log("Error starting conversation:", error);
    }
  }, [conversation, agentId, user]);

  const stopConversation = useCallback(async () => {
    try {
      if (conversation.status !== "connected") {
        return;
      }

      // Stop all tracks in the conversation's media stream
      if (conversation.mediaStream) {
        conversation.mediaStream.getTracks().forEach(track => track.stop());
      }

      await conversation.endSession();
      setTranscripts([]);
      setIsMicMuted(false);
      setIsThinking(false);
      dispatch(fetchUser(baseURL));
    } catch (error) {
      console.log("Error stopping conversation:", error);
    }
  }, [conversation]);

  const stopRecording = () => {
    stopConversation();
  };

  const startRecording = () => {
    startConversation();
  };

  const handleComplete = (completedText, index) => {
    // This function is intentionally left empty
    // No longer clearing the transcript on completion
  };

  const getAuthorizedUrl = async () => {
    try {
      const response = await api.get(`${baseURL}/v1/user/getAuthorizedUrl`, {
        withCredentials: true,
      });
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const handleProfileClick = () => {
    navigate("/settings");
  };

  useEffect(() => {
    getAuthorizedUrl();
  }, []);

  const addPhoneNumber = async (e) => {
    try {
      e.preventDefault();
      const response = await api.post(
        `${baseURL}/v1/user/addPhoneNumber/`,
        { phone_number: phoneNumber.trim() },
        { withCredentials: true }
      );
      setPhoneNumberProvided(true);
      alert("Phone number saved successfully");
      dispatch(fetchUser(baseURL));
    } catch (err) {
      alert(err.response.data.message);
    }
  };

  if (loading) return <div>Loading....</div>;

  return (
    <div className="container">
      {!phoneNumberProvided && (
        <div className="popup-card">
          <button className="popup-close-button" onClick={handleClosePopup}>
            <img src={closeicon} alt="Close" />
          </button>
          <h2 className="popup-heading">Please enter your phone number</h2>
          <p className="popup-text">
            Lisa will use this to send you a message when your morning brief is
            ready.
          </p>
          <form onSubmit={addPhoneNumber}>
            <input
              type="tel"
              className="popup-input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              required
            />
            <button type="submit" className="popup-button">
              Submit
            </button>
          </form>
        </div>
      )}

      <div className="company-name">Lisa</div>

      <div className="profile-button" onClick={handleProfileClick}>
        <div className="profile-icon"></div>
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
          {!user.morning_update_check ? (
            <div className="briefing-container">
              <div className="briefing-text">Your morning brief is ready</div>
              <div className="listen-button" onClick={startRecording}>
                Listen
              </div>
            </div>
          ) : (
            <>
              <FeatureList />
              <div className="heading">What can I do for you today?</div>
            </>
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

          <div className="start-button" onClick={startRecording}>
            Press to start
          </div>
        </>
      )}

      <Footer />
    </div>
  );
};

export default Main;
