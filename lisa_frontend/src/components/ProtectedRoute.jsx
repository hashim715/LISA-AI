import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useOnline from "../hooks/useOnline";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const { isOnline, hasInternet } = useOnline();

  if (!isOnline) return <p>No Network..</p>;

  if (!hasInternet) return <p>No internet access...</p>;

  if (loading) return <p>Loading...</p>;

  return user ? <Outlet /> : <Navigate to="/" replace />;
};

export default ProtectedRoute;
