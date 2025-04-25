import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import "../styles/Terms.css";

const Terms = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

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
        <h1 className="about-title">Terms of Service</h1>

        <div className="about-prose">
          <p className="about-date">Last Updated: April 11, 2025</p>

          <section className="about-section">
            <h3 className="about-section-title">1. Introduction</h3>
            <p className="about-text">
              Welcome to Lisa, your executive assistant powered by advanced
              artificial intelligence, provided by Lisa Intelligence, Inc., a Delaware
              Corporation ("Lisa Intelligence, Inc."). By accessing or using Lisa, you agree to
              these Terms of Service ("Terms"). If you disagree, please do not
              use Lisa.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">2. Eligibility</h3>
            <p className="about-text">
              You must be at least 18 years old to use Lisa. You represent that
              you have the authority to use Lisa on behalf of your organization.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">3. User Accounts</h3>
            <ul className="about-section">
              Accurate personal and business contact information is required.
              <br />
              Maintain the confidentiality of your account credentials.
              <br />
              Notify us immediately if unauthorized use is detected.
            </ul>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">4. Service Limitations</h3>
            <p className="about-text">
              Lisa is not a substitute for professional advice (legal,
              financial, medical). Responses provided by Lisa may be incomplete,
              incorrect, or inappropriate. You acknowledge that AI-generated
              assistance is subject to inherent technical limitations.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">5. Liability Disclaimer</h3>
            <p className="about-text">
              Lisa is provided "as-is" without warranties of any kind, explicit
              or implied. Lisa is not liable for any damages or losses arising
              from your use of the service. Users are solely responsible for
              decisions made based on information provided by Lisa.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">6. Data Privacy</h3>
            <p className="about-text">
              Your data is securely stored and protected using industry-standard
              encryption. Lisa will use data to enhance and personalize
              services. Data sharing with third parties will be anonymized
              unless otherwise explicitly agreed.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">7. Intellectual Property</h3>
            <p className="about-text">
              Lisa retains all rights to its proprietary technology, services,
              and interfaces. Users retain ownership of their content input,
              granting Lisa a license to use such content solely to provide and
              enhance the services.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">8. Prohibited Uses</h3>
            <ul className="about-section">
              You agree not to:
              <br />
              Use Lisa for unlawful or malicious purposes.
              <br />
              Share your account credentials.
              <br />
              Attempt unauthorized access or disrupt Lisa services.
              <br />
              Reverse engineer or replicate Lisa technology.
            </ul>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">9. Termination</h3>
            <p className="about-text">
              Lisa reserves the right to suspend or terminate accounts for
              violations of these terms or inactivity.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">10. Third-party Services</h3>
            <p className="about-text">
              Lisa may include integrations with external platforms. Lisa is not
              responsible for third-party content, security, or privacy
              practices.
            </p>
            <p className="about-text">
              <strong>Google Workspace API Usage:</strong> By using Lisa's integration with Google Workspace services, you acknowledge and agree that we use Google Workspace APIs solely for providing the service's core functionality. We explicitly confirm that we do not use any data obtained through Google Workspace APIs to develop, improve, or train generalized AI and/or ML models. All data accessed through these APIs is used exclusively for the intended service features and is not repurposed for any other use.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">11. Updates to Terms</h3>
            <p className="about-text">
              These terms may be updated periodically. Continued use indicates
              acceptance of any changes. Material updates communicated via
              email.
            </p>
          </section>

          <section className="about-section">
            <h3 className="about-section-title">12. Contact Information</h3>
            <p className="about-text">
              Lisa Intelligence, Inc.
              <br />
              8 The Green Ste R
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
            these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
