import React from "react";
import { Helmet } from "react-helmet";
import { Router } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import store, { persistor } from "./store";
import history from "./services/history";
import Routes from "./routes";

function App() {
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <Router history={history}>
          <Helmet>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
            <link
              href="https://fonts.googleapis.com/css2?family=Khula:wght@400;600;800&display=swap"
              rel="stylesheet"
            />
          </Helmet>
          <Routes />
          <ToastContainer autoClose={2000} className="toats-container" />
        </Router>
      </PersistGate>
    </Provider>
  );
}

export default App;
