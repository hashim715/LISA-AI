import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/signIn.css";
import axios from "axios";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useOnline from "../hooks/useOnline";
import { useSelector } from "react-redux";
import Footer from "./footer";

const SignIn = () => {
  const navigate = useNavigate();

  const baseURL = useSelector((state) => state.baseUrl.url);
  const { user, loading } = useAuth();
  const { isOnline, hasInternet } = useOnline();

  const handleSignInForGoogle = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/google`);
      window.location.replace(response.data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSignInForOutlook = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/outlook`);
      window.location.replace(response.data.message);
    } catch (err) {
      console.log(err);
    }
  };

  if (!isOnline) return <p>No Network..</p>;

  if (!hasInternet) return <p>No internet access...</p>;

  if (loading) return <p>Loading...</p>;

  return user ? (
    <Navigate to="/main" />
  ) : (
    <div className="container">
      <div className="company-name">Lisa</div>
      <div className="go-to-home-button" onClick={() => navigate("/")}>
        Talk to Lisa
      </div>

      <div className="center-content">
        <div className="image-container"></div>
        <div className="center-buttons">
          <div className="tagline">
            Focus on what matters.
            <br />
            Sign up today.
          </div>
          <button onClick={handleSignInForGoogle} onTouchStart={handleSignInForGoogle} className="login-button">
            <svg
              width="20"
              height="20"
              viewBox="0 0 488 512"
              fill="currentColor"
            >
              <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
            </svg>
            Continue with Gmail
          </button>

          <button onClick={handleSignInForOutlook} onTouchStart={handleSignInForOutlook} className="login-button">
            <svg
              width="20"
              height="20"
              viewBox="0 0 488 512"
              fill="currentColor"
            >
              <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z" />
            </svg>
            Continue with Microsoft
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SignIn;
