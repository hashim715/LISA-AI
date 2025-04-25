import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { fetchUser, authActions } from "../store/reducer/auth-slice";
import { useNavigate } from "react-router-dom";

const useAxios = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const baseURL = useSelector((state) => state.baseUrl.url);
  const navigate = useNavigate();

  const axiosInstance = axios.create({
    url: baseURL,
  });

  const handleSignOut = async () => {
    try {
      const response = await axios.get(`${baseURL}/v1/auth/logout`, {
        withCredentials: true,
      });
      navigate("/login");
    } catch (err) {
      console.log(err);
    }
  };

  axiosInstance.interceptors.request.use(async (req) => {
    try {
      const expiresAt = new Date(user?.expiresAt); // Expiry time from user data
      const currentTime = new Date(); // Get current time in seconds
      const isExpired = expiresAt < currentTime;
      if (!isExpired) {
        return req;
      } else {
        try {
          const response = await axios.post(
            `${baseURL}/v1/auth/refresh/`,
            {},
            { withCredentials: true }
          );
          const user = response.data.user;
          dispatch(fetchUser(baseURL));
          return req;
        } catch (error) {
          dispatch(authActions.logout());
          await handleSignOut();
        }
      }
    } catch (error) {
      dispatch(authActions.logout());
      await handleSignOut();
    }
  });
  return axiosInstance;
};

export default useAxios;
