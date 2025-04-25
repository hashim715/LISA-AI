import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";

const OutlookOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const baseURL = useSelector((state) => state.baseUrl.url);
  const navigate = useNavigate();

  const getToken = async (oauthCode) => {
    try {
      const response = await axios.post(
        `${baseURL}/v1/auth/outlook/callback/`,
        {
          code: oauthCode,
        },
        { withCredentials: true }
      );
      console.log(response.data);
      if (response.status === 201) {
        navigate("/settings");
      } else {
        navigate("/main");
      }
    } catch (err) {
      console.log(err);
      navigate("/");
    }
  };

  useEffect(() => {
    if (code) {
      getToken(code);
    } else {
      navigate("/");
    }
  }, [code]);

  return <h1>Processing Outlook OAuth Callback...</h1>;
};

export default OutlookOAuthCallback;
