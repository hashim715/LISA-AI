import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";

const NotionOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const baseURL = useSelector((state) => state.baseUrl.url);
  const navigate = useNavigate();

  const getToken = async (oauthCode) => {
    try {
      const response = await axios.post(
        `${baseURL}/v1/auth/notion/callback/`,
        {
          code: oauthCode,
        },
        { withCredentials: true }
      );
      navigate("/main");
    } catch (err) {
      console.log(err);
      navigate("/");
    }
  };

  useEffect(() => {
    if (code) {
      console.log(code);
      getToken(code);
    } else {
      navigate("/");
    }
  }, [code]);

  return <h1>Processing Notion OAuth Callback...</h1>;
};

export default NotionOAuthCallback;
