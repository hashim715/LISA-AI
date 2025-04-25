import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import "../styles/PrivacyPolicy.css";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleClick = () => {
    navigate("/main");
  };

  return (
    <div className="about-container">
      <div className="company-name" onClick={() => navigate("/main")}>
        Lisa
      </div>
      {!user && (
        <div className="the-login-button" onClick={() => navigate("/login")}>
          Log in or Sign up
        </div>
      )}
      <div className="about-content">
        <h1 className="about-title">Privacy Policy</h1>

        <div className="about-prose">
          <p className="about-date">Last Updated: April 11, 2025</p>

          <section className="about-section">
            <h3 className="about-section-title">Introduction</h3>
            <p className="about-text">
              Welcome to Lisa, provided by Lisa Intelligence, Inc., a Delaware Corporation
              ("Lisa Intelligence, Inc."). This Privacy Policy explains how we handle your data
              when you use our executive assistant services.
            </p>
            <p className="about-text">
              By using Lisa AI, you agree to this Privacy Policy.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">1. Data Collection</h3>
            <p className="about-text"></p>
            <p className="about-text">
              Lisa may collect the following data: <br />
              Personal and business contact information provided during account
              setup.
              <br />
              Business-related information necessary to deliver personalized
              assistance.
              <br />
              Usage data including interactions, commands, and preferences.
              <br />
              Information accessed from integrated third-party applications such
              as: Email (Google Mail, Microsoft Outlook),
              <br />
              Calendar (Google Calendar, Microsoft Outlook Calendar), Notion,
              Slack
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">2. Use of Data</h3>
            <p className="about-text"></p>
            <div className="about-section">
              Your data is used to: <br />
              Provide and personalize Lisa services.
              <br />
              Draft and send messages, schedule meetings, and manage tasks on
              your behalf through connected applications such as: Email (Google
              Mail, Microsoft Outlook),
              <br />
              Calendar (Google Calendar, Microsoft Outlook Calendar), Notion,
              Slack.
              <br />
              Communicate updates, offers, and important notices.
              <br />
            </div>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">3. Data Sharing</h3>
            <p className="about-text">
              Lisa does not sell or share your identifiable personal or business
              data with third parties without explicit consent, except as
              required by law with trusted third-party providers essential for
              service operation (subject to strict confidentiality agreements).
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">4. Data Security</h3>
            <p className="about-text">
              All data is secured using industry-standard encryption and
              security measures. Data transmissions are encrypted using secure
              protocols (e.g., TLS). Access to data is restricted and monitored.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">
              5. Data Retention and Deletion
            </h3>
            <p className="about-text">
              Data is retained only as long as necessary to provide services or
              comply with legal obligations. You can request data access,
              correction, or deletion by contacting support@ourlisa.com.
              Requests are fulfilled within 30 days.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">6. Third-party Integrations</h3>
            <p className="about-text"></p>
            <p className="about-text">
              Lisa integrates with third-party services, such as: <br />
              Email (Google Mail, Microsoft Outlook),
              <br />
              Calendar (Google Calendar, Microsoft Outlook Calendar), Notion,
              Slack.
              <br />
            </p>
            <p className="about-text">
              You authorize Lisa to access, draft, send messages, set up
              meetings, and manage tasks within these third-party applications.
              You are responsible for reviewing third-party privacy policies and
              terms. Lisa is not responsible for third-party practices or data
              handling.
            </p>
            <p className="about-text">
              <strong>Google Workspace API Usage:</strong> Lisa uses Google Workspace APIs solely for the purpose of providing the service's core functionality. We do not use any data obtained through Google Workspace APIs to develop, improve, or train generalized AI and/or ML models. All data accessed through these APIs is used exclusively for the intended service features and is not repurposed for any other use.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">
              7. Communication Preferences
            </h3>
            <p className="about-text">
              Lisa sends service-related emails and optional promotional
              communications. You may opt-out of promotional communications via
              email instructions.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">8. Data Rights</h3>
            <p className="about-text">
              You have the right to request access, correction, or deletion of
              your personal data. To exercise your rights, contact us at
              support@ourlisa.com.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">9. Changes to This Policy</h3>
            <p className="about-text">
              Lisa reserves the right to update this policy periodically.
              Updates will be communicated via email and posted online.
              Continued use of Lisa after updates indicates acceptance of
              changes.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">10. Contact Information</h3>
            <p className="about-text">
              Lisa Intelligence, Inc.
              <br />
              8 The Green Ste R,
              <br />
              Dover, DE 19901
              <br />
              Kent, United States
              <br />
              Email:{" "}
              <a href="mailto:support@ourlisa.com" className="about-link">
                support@ourlisa.com
              </a>
            </p>
          </section>

          <p className="about-agreement">
            By using Lisa, you confirm you've read, understood, and agree to
            this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
