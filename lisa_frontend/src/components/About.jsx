import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import "../styles/About.css";
import lisa_demo from "../assets/lisa_demo.mp4";
import about_one from "../assets/about-one.png";
import about_two from "../assets/about-two.png";
import about_three from "../assets/about-three.png";
import about_four from "../assets/about-four.png";

const About = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleClick = () => {
    navigate("/main");
  };

  return (
    <div className="about-lisa-container">
      <div className="company-name" onClick={() => navigate("/main")}>
        Lisa
      </div>
      <div className="the-tryout-button" onClick={() => navigate("/main")}>
        See Lisa in Action
      </div>
      <div className="title-box">
        <h1 className="lisa-heading">
          Built for founders
          <br />
          who move at the speed of life
        </h1>
        <p className="text">
          no checking emails, scheduling meetings,
          <br />
          handling notion lists, finding events, or
          <br />
          keeping up with new launches
          <br />
          <br />- just talk to lisa and she will get it done.
        </p>
      </div>
      <div className="lisa-video-container">
        <video className="lisa-video" autoPlay loop muted playsInline>
          <source src={lisa_demo} type="video/mp4" />
        </video>
      </div>
      <h1 className="lisa-subheading-2">Meet your AI Co-Founder</h1>
      <div className="card">
        <div className="card-inner-left">
          <div className="card-inner-left-heading">Connect everything!</div>
          <p className="card-inner-left-text">
            all your tools in one brain. email, calendar, slack, notion — lisa
            plugs in, syncs up, and understands your world instantly. no more
            switching tabs. no more "where's that link?"
          </p>
        </div>
        <div className="card-inner-right">
          <img src={about_one} alt="lisa" className="card-inner-right-image" />
        </div>
      </div>
      <div className="card card-reversed">
        <div className="card-inner-left">
          <div className="card-inner-left-heading">Jusk ask?</div>
          <p className="card-inner-left-text">
            speak and lisa gets it done. from investor updates to managing
            to-dos, product launches to new events—if you can say it, lisa will
            do it. your voice is the new command line.
          </p>
        </div>
        <div className="card-inner-right">
          <img src={about_two} alt="lisa" className="card-inner-right-image" />
        </div>
      </div>
      <div className="card">
        <div className="card-inner-left">
          <div className="card-inner-left-heading">Wake up locked in..</div>
          <p className="card-inner-left-text">
            start every day ahead. lisa scans your inbox, meetings, updates, and
            news — then gives you a crisp, personalized breakdown of what
            actually matters. no noise. all signal.
          </p>
        </div>
        <div className="card-inner-right">
          <img
            src={about_three}
            alt="lisa"
            className="card-inner-right-image"
          />
        </div>
      </div>
      <div className="card card-reversed">
        <div className="card-inner-left">
          <div className="card-inner-left-heading">Your data. Your rules.</div>
          <p className="card-inner-left-text">
            engineered for trust — not tracking. your data stays yours:
            encrypted, secure, and untouchable. lisa works for you, not on you.
          </p>
        </div>
        <div className="card-inner-right">
          <img src={about_four} alt="lisa" className="card-inner-right-image" />
        </div>
      </div>
      <div className="bottom-text">
        Siri sets alarms <br />
        Alexa plays music <br />
        Google reads the weather <br /> <br />
        <span className="bold-text">Lisa gets sh*t done.</span>
      </div>
      <button className="get-started-button" onClick={handleClick}>
        See Lisa in Action
      </button>
      <div className="footer">
        <div className="footer-links">
          <a href="/about" className="footer-link">
            Home
          </a>
          <a href="/privacy" className="footer-link">
            Privacy Policy
          </a>
          <a href="/terms" className="footer-link">
            Terms of Service
          </a>
          <a href="/contact" className="footer-link">
            Contact
          </a>
        </div>
        <div className="footer-copyright">
          © 2024 Lisa. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default About;
