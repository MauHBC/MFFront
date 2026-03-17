import storage from "redux-persist/lib/storage";
import { persistReducer } from "redux-persist";

const AUTH_PERSIST_VERSION = "v2";
const PERSIST_KEY = `CONSUMO-API:${AUTH_PERSIST_VERSION}`;

export default (reducers) => {
  const persistedReducers = persistReducer(
    {
      key: PERSIST_KEY,
      storage,
      whitelist: ["auth"],
    },
    reducers,
  );

  return persistedReducers;
};
