import { configureStore } from "@reduxjs/toolkit";
import getbaseUrlReducer from "./reducer/getbaseUrlReducer";
import authSlice from "./reducer/auth-slice";

const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    baseUrl: getbaseUrlReducer.reducer,
  },
});

export default store;
