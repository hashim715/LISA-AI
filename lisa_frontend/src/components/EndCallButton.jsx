import React from 'react';

const styles = {
  Button: {
    cursor: 'pointer',
    width: '145px',
    height: '42px',
    padding: '0px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: '9px',
    border: '2px solid #ff9999',
    boxSizing: 'border-box',
    borderRadius: '100000px',
    boxShadow: '0px 0px 10px #ffffff',
    backgroundColor: '#ffeaea',
    color: '#ff0000',
    fontSize: '14px',
    fontFamily: 'Archivo',
    fontWeight: '500',
    lineHeight: '23px',
    outline: 'none',
  },
  Icon: {
    fontSize: '18px',
    width: '18px',
    height: '18px',
    color: '#ff0000',
    fill: '#ff0000',
  },
};

const IconComponent = () => (
  <svg style={styles.Icon} viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
  </svg>
);

const EndCallButton = ({ onClick }) => {
  return (
    <button style={styles.Button} onClick={onClick}>
      <span>End Call</span>
      <IconComponent />
    </button>
  );
};

export default EndCallButton; 