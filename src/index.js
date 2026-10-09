import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Importando os estilos CSS
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "./styles/flexboxgrid.min.css";
import "./styles/index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
const LocalPreview = process.env.NODE_ENV === "development"
  && window.location.hostname === "127.0.0.1"
  && window.location.port === "3050"
  && window.location.pathname === "/whatsapp-simulacao"
  // Webpack eliminates this branch from production bundles.
  ? require("./pages/Agendamentos/WhatsAppSimulation").default
  : App;

root.render(
  <React.StrictMode>
    <LocalPreview />
  </React.StrictMode>,
);
