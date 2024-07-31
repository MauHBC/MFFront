import { combineReducers } from "redux";
import auth from "./auth/reducer";
import realEstateData from "./realestatedata/reducer";

export default combineReducers({
  auth,
  realEstateData,
});
