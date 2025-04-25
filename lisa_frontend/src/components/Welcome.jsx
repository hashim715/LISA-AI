import React from "react";
import { useSelector } from "react-redux";
import { useEffect } from "react";
import useAxios from "../utils/useAxios";
import useAuth from "../hooks/useAuth";
import useOnline from "../hooks/useOnline";
import axios from "axios";

const Welcome = () => {
  const baseURL = useSelector((state) => state.baseUrl.url);
  const api = useAxios();
  const { user, loading } = useAuth();
  const { isOnline, hasInternet } = useOnline();

  const refreshAccessTokens = async () => {
    try {
      const response = await api.get(`${baseURL}/v1/user/refreshAccessTokens`, {
        withCredentials: true,
      });
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const addGoogleCalenderEvent = async () => {
    try {
      const response = await api.post(
        `${baseURL}/v1/user/addGoogleCalenderEvent/`,
        {
          token: user.token,
          text: "Schedule a meeting with waloo muloo from 9pm to 10pm on april 14 in islamabad pakistan the meeting is about discussin of ongoing project.",
          type: "google",
        }
      );
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const draftGoogleGmail = async () => {
    try {
      const response = await api.post(`${baseURL}/v1/user/draftGoogleGmail/`, {
        token: user.token,
        text: "write an email to muhammad haris saying hi i love you baby",
        type: "google",
      });
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const draftGoogleGmailReply = async () => {
    try {
      const response = await api.post(
        `${baseURL}/v1/user/draftReplyGoogleGmail/`,
        {
          token: user.token,
          text: "could you please send reply email to gama saying thankyou for welcoming me",
          type: "google",
        }
      );
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const updateGoogleCalenderEvent = async () => {
    try {
      const response = await axios.post(
        `${baseURL}/v1/user/updateGoogleCalenderEvent/`,
        {
          token: user.token,
          text: "could you please update my calender event named as meeeting with developers team setting the time from 2 pm to 3 pm and add description that there is going to be a long discussion on something innovative.",
          type: "gmail",
        }
      );
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  const deleteGoogleCalenderEvent = async () => {
    try {
      const response = await axios.post(
        `${baseURL}/v1/user/deleteGoogleCalenderEvent/`,
        {
          token: user.token,
          text: "could you please delete my calender event named as meeting with developers team",
          type: "gmail",
        }
      );
      console.log(response.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    // setTimeout(() => {
    //   navigate("/main");
    // }, 1000);
    updateGoogleCalenderEvent();
    //deleteGoogleCalenderEvent();
  }, [user]);

  if (!isOnline) return <p>No Network..</p>;

  if (!hasInternet) return <p>No internet access...</p>;

  if (loading) return <p>Loading...</p>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-800">Welcome</h1>
    </div>
  );
};

export default Welcome;
