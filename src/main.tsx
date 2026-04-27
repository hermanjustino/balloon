import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { ContestantIndex } from './components/pages/ContestantIndex';
import { ContestantProfile } from './components/pages/ContestantProfile';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/contestants" element={<ContestantIndex />} />
                <Route path="/contestants/:slug" element={<ContestantProfile />} />
                <Route path="*" element={<App />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
