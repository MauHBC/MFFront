import { useSelector } from "react-redux";

export const useRealEstate = () => {
  return useSelector((state) => state.auth.user.real_estate_names);
};