import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ImpersonationProvider } from '@/shell/ImpersonationContext';
import { AuthProvider } from '@/shell/AuthContext';
import { App } from '@/shell/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ImpersonationProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ImpersonationProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
