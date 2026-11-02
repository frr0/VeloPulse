import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { isAndroid } from './utils/platform';
import 'leaflet/dist/leaflet.css';
import './index.css';

if (isAndroid()) {
  document.documentElement.classList.add('android-app', 'mobile-app');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
