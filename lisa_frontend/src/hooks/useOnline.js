import { useState, useEffect } from "react";

function useInternetStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasInternet, setHasInternet] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        checkInternetAccess(); // Verify internet only when coming online
      } else {
        setHasInternet(false); // Assume no internet if offline
      }
    };

    const checkInternetAccess = async () => {
      try {
        // Fetch a lightweight, fast-loading resource
        await fetch("https://www.google.com/favicon.ico", { mode: "no-cors" });
        setHasInternet(true);
      } catch (error) {
        setHasInternet(false);
      }
    };

    // Attach event listeners for instant network detection
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // Initial check
    if (navigator.onLine) {
      checkInternetAccess();
    }

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return { isOnline, hasInternet };
}

export default useInternetStatus;
