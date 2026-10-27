import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import StudioApp from "./StudioApp.jsx";
import "./studio.css";

// Story Studio: the agency's own tool, a separate page from the client app (it is served at /studio).
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename="/studio"><StudioApp /></BrowserRouter>
  </StrictMode>,
);
