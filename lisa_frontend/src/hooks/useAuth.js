import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchUser } from "../store/reducer/auth-slice";

const useAuth = () => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);
  const baseURL = useSelector((state) => state.baseUrl.url);

  useEffect(() => {
    if (!user) {
      dispatch(fetchUser(baseURL));
    }
  }, [dispatch, baseURL, user]);

  return { user, loading };
};

export default useAuth;
