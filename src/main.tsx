import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { ContestantIndex } from './components/pages/ContestantIndex';
import { ContestantProfile } from './components/pages/ContestantProfile';
import { EpisodeIndex } from './components/pages/EpisodeIndex';
import { EpisodePage } from './components/pages/EpisodePage';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/contestants" element={<ContestantIndex />} />
                <Route path="/contestants/:slug" element={<ContestantProfile />} />
                <Route path="/episodes" element={<EpisodeIndex />} />
                <Route path="/episodes/:id" element={<EpisodePage />} />
                <Route path="*" element={<App />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
