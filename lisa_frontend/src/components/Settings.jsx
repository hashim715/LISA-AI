import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Settings.css";
import profileImage from "../assets/profile.jpeg";
import gmailIcon from "../assets/gmail.png";
import gmailCalendarIcon from "../assets/gmail_calendar.png";
import outlookIcon from "../assets/outlook.jpeg";
import outlookCalendarIcon from "../assets/outlook_calendar.png";
import notionIcon from "../assets/notion.png";
import slackIcon from "../assets/slack.png";
import closeIcon from "../assets/close.png";
import githubIcon from "../assets/github.png";
import mercuryIcon from "../assets/mercury.png";
import brexIcon from "../assets/brex.png";
import { useSelector, useDispatch } from "react-redux";
import { authActions } from "../store/reducer/auth-slice";
import useAxios from "../utils/useAxios";
import axios from "axios";
import useAuth from "../hooks/useAuth";
import { fetchUser } from "../store/reducer/auth-slice";

const regionToTimeZone = {
  "America/Los_Angeles": "Pacific",
  "America/Denver": "Mountain",
  "America/Chicago": "Central",
  "America/New_York": "Eastern",
};

const Settings = () => {
  const [helpText, setHelpText] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const baseURL = useSelector((state) => state.baseUrl.url);
  const dispatch = useDispatch();
  const { user, loading } = useAuth();
  const [memoryText, setMemoryText] = useState(
    user.preferences ? user.preferences : ""
  );
  const api = useAxios();
  const [editingField, setEditingField] = useState(null);
  const [selectedTime, setSelectedTime] = useState(
    user.morning_brief_time ? user.morning_brief_time : "6:00 AM"
  );

  const [selectedRegion, setSelectedRegion] = useState(
    user.timeZone ? regionToTimeZone[user.timeZone] : "Pacific"
  );
  const [preferences, setPreferences] = useState(
    user.morning_update_preferences ? user.morning_update_preferences : ""
  );
  const [selectedCategory, setSelectedCategory] = useState(
    !user.preferences_added ? "Connectors" : "General"
  );
  const [selectedImage, setSelectedImage] = useState(
    user.profile_image ? user.profile_image : null
  );

  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone_number,
    company: user.company_name,
    position: user.position,
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);

  const categories = [
    "General",
    "Connectors",
    "Morning Brief",
    "Lisa's Memory",
    "Get Help",
  ];

  const timeOptions = [
    "6:00 AM",
    "6:30 AM",
    "7:00 AM",
    "7:30 AM",
    "8:00 AM",
    "8:30 AM",
    "9:00 AM",
    "9:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "09:51 AM",
    "02:06 PM",
  ].filter((time) => time !== user.morning_brief_time);

  const regionOptions = ["Pacific", "Mountain", "Central", "Eastern"];
  const cloudinary_id = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_ID;

  const uploadPicturestoCloudinary = async (image) => {
    if (!image) {
      return null;
    }

    const formData = new FormData();
    formData.append("file", image);
    formData.append("upload_preset", "lisa_images");

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinary_id}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        console.log("Upload successful:", data);
        return data.secure_url;
      }

      return null;
    } catch (err) {
      console.log(err);
      return null;
    }
  };

  const handleLogout = async () => {
    try {
      const response = await api.get(`${baseURL}/v1/auth/logout`, {
        withCredentials: true,
      });
      dispatch(authActions.logout());
      navigate("/login");
    } catch (err) {
      console.log(err);
    }
  };

  const handleSignInForNotion = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/notion`, {
        withCredentials: true,
      });
      window.location.replace(response.data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSignInForOutlook = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/outlook`, {
        withCredentials: true,
      });
      window.location.replace(response.data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSignInForGoogle = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/google`, {
        withCredentials: true,
      });
      window.location.replace(response.data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSignInForSlack = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/slack`, {
        withCredentials: true,
      });
      window.location.replace(response.data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleClose = () => {
    navigate("/main");
  };

  const handleSaveMemory = async () => {
    try {
      const response = await api.post(
        `${baseURL}/v1/user/updateUserPreferences/`,
        { prompt: memoryText },
        { withCredentials: true }
      );
      dispatch(fetchUser(baseURL));
      alert("Your preferences are saved successfully");
    } catch (err) {
      console.log(err);
      alert(err.response.data.message);
    }
  };

  const handleSaveMorningPreferences = async () => {
    try {
      setIsSavingPreferences(true);
      const response = await api.post(
        `${baseURL}/v1/user/addMorningPreferences/`,
        {
          prompt: preferences,
          morningBriefTime: selectedTime,
          region: selectedRegion,
        },
        { withCredentials: true }
      );
      dispatch(fetchUser(baseURL));
      alert("Morning preferences saved successfully");
    } catch (err) {
      console.log(err);
      alert(err.response.data.message);
    }
  };

  const handleSubmitHelp = async () => {
    try {
      setIsSubmittingHelp(true);
      console.log("Help submitted:", helpText);
    } catch (err) {
      console.log(err);
    } finally {
      setIsSubmittingHelp(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  const handleSaveProfile = async () => {
    try {
      const imageUrl = await uploadPicturestoCloudinary(selectedImage);

      const response = await api.post(
        `${baseURL}/v1/user/addUserDetails/`,
        {
          company_name: profileData.company,
          position: profileData.position,
          profile_image: imageUrl ? imageUrl : user.profile_image,
        },
        { withCredentials: true }
      );
      dispatch(fetchUser(baseURL));
      alert("Profile data saved successfully");
    } catch (err) {
      console.log(err);
      alert(err.response.data.message);
    }
  };

  const handleFieldClick = (field) => {
    setEditingField(field);
  };

  const handleFieldChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFieldBlur = () => {
    setEditingField(null);
  };

  const renderProfileField = (label, field) => {
    return (
      <div className="profile-field">
        <span className="field-label">{label}</span>
        {editingField === field ? (
          <input
            type="text"
            className="field-input"
            value={profileData[field]}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            onBlur={handleFieldBlur}
            autoFocus
          />
        ) : (
          <span className="field-value" onClick={() => handleFieldClick(field)}>
            {profileData[field]}
          </span>
        )}
      </div>
    );
  };

  const renderMainContent = () => {
    if (selectedCategory === "General") {
      return (
        <div className="profile-section">
          <div className="profile-header">
            <div className="profile-picture" onClick={handleImageClick}>
              <img src={selectedImage || profileImage} alt="Profile" />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                style={{ display: "none" }}
              />
              <div className="upload-overlay">
                <span>Click to upload</span>
              </div>
            </div>
          </div>
          <div className="profile-details">
            {renderProfileField("Name", "name")}
            {renderProfileField("Email", "email")}
            {renderProfileField("Phone", "phone")}
            {renderProfileField("Company", "company")}
            {renderProfileField("Position", "position")}
          </div>
          <button
            className="save-button"
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </button>
        </div>
      );
    } else if (selectedCategory === "Connectors") {
      return (
        <div className="connectors-section">
          <div
            className="connector-box"
            onClick={() => {
              if (!user.google_login) {
                handleSignInForGoogle();
              }
            }}
            style={{ cursor: !user.google_login ? "pointer" : "default" }}
          >
            <div className="connector-icons">
              <img
                src={gmailIcon}
                alt="Gmail"
                className="connector-icon-gmail"
              />
              <img
                src={gmailCalendarIcon}
                alt="Google Calendar"
                className="connector-icon-google-calendar"
              />
            </div>
            <div className="connector-name">Google Gmail and Calendar</div>
            <div
              className={`connector-status ${
                user.google_login ? "connected" : "not-connected"
              }`}
            >
              {user.google_login ? (
                "Connected"
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent bubbling to parent onClick
                    handleSignInForGoogle();
                  }}
                >
                  Connect your Gmail Account
                </button>
              )}
            </div>
          </div>

          <div
            className="connector-box"
            onClick={() => {
              if (!user.outlook_login) {
                handleSignInForOutlook();
              }
            }}
            style={{ cursor: !user.outlook_login ? "pointer" : "default" }}
          >
            <div className="connector-icons">
              <img
                src={outlookIcon}
                alt="Outlook"
                className="connector-icon-outlook"
              />
              <img
                src={outlookCalendarIcon}
                alt="Outlook Calendar"
                className="connector-icon-outlook-calendar"
              />
            </div>
            <div className="connector-name">Outlook and Calendar</div>
            <div
              className={`connector-status ${
                user.outlook_login ? "connected" : "not-connected"
              }`}
            >
              {user.outlook_login ? (
                "Connected"
              ) : (
                //onClick={handleSignInForOutlook}
                <button>
                  {/* Connect your Outlook Account */}
                  Coming Soon
                </button>
              )}
            </div>
          </div>
          <div
            className="connector-box"
            onClick={() => {
              if (!user.notion_login) {
                handleSignInForNotion();
              }
            }}
            style={{ cursor: !user.notion_login ? "pointer" : "default" }}
          >
            <div className="connector-icons">
              <img
                src={notionIcon}
                alt="Notion"
                className="connector-icon-notion"
              />
            </div>
            <div className="connector-name">Notion</div>
            <div
              className={`connector-status ${
                user.notion_login ? "connected" : "not-connected"
              }`}
            >
              {user.notion_login ? (
                "Connected"
              ) : (
                <button onClick={handleSignInForNotion}>
                  Connect your Notion Account
                </button>
              )}
            </div>
          </div>
          <div
            className="connector-box"
            onClick={() => {
              if (!user.slack_login) {
                handleSignInForSlack();
              }
            }}
            style={{ cursor: !user.slack_login ? "pointer" : "default" }}
          >
            <div className="connector-icons">
              <img
                src={slackIcon}
                alt="Slack"
                className="connector-icon-slack"
              />
            </div>
            <div className="connector-name">Slack</div>
            <div
              className={`connector-status ${
                user.slack_login ? "connected" : "not-connected"
              }`}
            >
              {user.slack_login ? (
                "Connected"
              ) : (
                <button onClick={handleSignInForSlack}>
                  Connect your Slack Account
                </button>
              )}
            </div>
          </div>
          <div
            className="connector-box"
            onClick={() => {
              if (!user.github_login) {
                handleSignInForGitHub();
              }
            }}
            style={{ cursor: !user.github_login ? "pointer" : "default" }}
          >
            <div className="connector-icons">
              <img
                src={githubIcon}
                alt="GitHub"
                className="connector-icon-github"
              />
            </div>
            <div className="connector-name">GitHub</div>
            <div className="connector-status not-connected">
              <button>Coming Soon</button>
            </div>
          </div>
          <div className="connector-box">
            <div className="connector-icons">
              <img
                src={mercuryIcon}
                alt="Mercury"
                className="connector-icon-mercury"
              />
              <img src={brexIcon} alt="Brex" className="connector-icon-brex" />
            </div>
            <div className="connector-name">Mercury and Brex</div>
            <div className="connector-status not-connected">
              <button>Coming Soon</button>
            </div>
          </div>
        </div>
      );
    } else if (selectedCategory === "Morning Brief") {
      return (
        <div className="morning-brief-section">
          <div className="input-group">
            <label className="input-label">
              Select the time you want to receive the morning brief at
            </label>
            <select
              className="time-select"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            >
              <option
                value={
                  user.morning_brief_time ? user.morning_brief_time : "6:00 AM"
                }
              >
                {user.morning_brief_time ? user.morning_brief_time : "6:00 AM"}
              </option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Select your region</label>
            <select
              className="time-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              {regionOptions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">
              Any specific request or preferences for morning briefs
            </label>
            <input
              type="text"
              className="preferences-input"
              placeholder="Ex. Y-Combinator News, Luma Events in SF, etc"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
            />
          </div>
          <button
            className="save-button-preferences"
            onClick={handleSaveMorningPreferences}
            disabled={isSavingPreferences}
          >
            {isSavingPreferences ? "Saving..." : "Save"}
          </button>
        </div>
      );
    } else if (selectedCategory === "Lisa's Memory") {
      return (
        <div className="memory-section">
          <div className="memory-description">
            <p>This is what Lisa knows about you.</p>
            <p>
              Lisa uses these guidelines to make the app more personalised to
              you.
            </p>
            <p>
              Feel free to change it according to your personal perferences.
            </p>
          </div>
          <textarea
            className="memory-textarea"
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            placeholder="For example, 
Co-founder & Head of Product at a seed-stage fintech startup in NYC, focused on user retention and pre-Series A. Interested in AI fintech, early-stage funding, and product growth. Wants updates on investor emails, key tasks, and local pitch events."
          />
          <button
            className="save-button-preferences-2"
            onClick={handleSaveMemory}
          >
            Save Changes
          </button>
        </div>
      );
    } else if (selectedCategory === "Get Help") {
      return (
        <div className="help-section">
          <div className="help-description">
            <p>Please mention any problems you're facing.</p>
            <p>Our team will reach out to you by the end of the day</p>
          </div>
          <textarea
            className="help-textarea"
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            placeholder="Describe your issue or question here..."
          />
          <button
            className="save-button-preferences-2"
            onClick={handleSubmitHelp}
          >
            Submit
          </button>
          <div className="the-contact-info">
            <p>You can also contact the founders directly at:</p>
            <p>
              Shahbaz Magsi, CEO,
              <a href="mailto:ceo@ourlisa.com" className="email-link">
                ceo@ourlisa.com
              </a>
              , (832) 512-4528
            </p>
            <p>
              Aazar Jan, CTO,
              <a href="mailto:cto@ourlisa.com" className="email-link">
                cto@ourlisa.com
              </a>
              , (346) 391-6054
            </p>
          </div>
        </div>
      );
    }
    return <h1 className="category-title">{selectedCategory}</h1>;
  };

  if (loading) return <div>Loading.....</div>;

  return (
    <div className="settings-container">
      <div className="settings-box">
        <div className="settings-sidebar">
          <div className="close-button-container-small" onClick={handleClose}>
            <button className="close-button-small">
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
          <div className="settings-heading-text">Settings</div>
          <div className="settings-heading-bar" />
          {categories.map((category) => (
            <button
              key={category}
              className={`sidebar-item ${
                selectedCategory === category ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
          <button className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
        <div className="settings-main">
          <div className="close-button-container" onClick={handleClose}>
            <button className="close-button">
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
          <div className="logout-button-container">
            <button className="logout-button-small" onClick={handleLogout}>
              Log out
            </button>
          </div>
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
