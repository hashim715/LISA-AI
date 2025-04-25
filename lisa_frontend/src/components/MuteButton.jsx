import React from "react";

const styles = {
  Button: {
    cursor: "pointer",
    width: "145px",
    height: "42px",
    padding: "0px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: "9px",
    border: "2px solid #e5e5e5",
    boxSizing: "border-box",
    borderRadius: "100000px",
    boxShadow: "0px 0px 10px #ffffff",
    backgroundColor: "#f2f2f2",
    color: "#424242",
    fontSize: "14px",
    fontFamily: "Archivo",
    fontWeight: "500",
    lineHeight: "23px",
    outline: "none",
  },
  Icon: {
    fontSize: "20px",
    width: "20px",
    height: "20px",
    color: "#424242",
    fill: "#424242",
  },
};

const IconComponent = () => (
  <svg style={styles.Icon} viewBox="0 0 24 24">
    <path d="M0 0h24v24H0zm0 0h24v24H0z" fill="none" />
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

const MuteButton = ({ isMuted, onClick }) => {
  return (
    <button style={styles.Button} onClick={onClick}>
      <span>{isMuted ? "Unmute" : "Mute"}</span>
      <IconComponent />
    </button>
  );
};

export default MuteButton;
