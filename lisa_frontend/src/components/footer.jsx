import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <div className="footer-links">
      <a href="/about" className="footer-link">
        About Lisa
      </a>
      <a href="/privacy" className="footer-link">
        Privacy Policy
      </a>
      <a href="/terms" className="footer-link">
        Terms of Service
      </a>
      <a href="/contact" className="footer-link">
        Contact Us
      </a>
    </div>
  );
};

export default Footer;
