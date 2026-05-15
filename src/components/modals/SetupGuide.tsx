import React from 'react';

export const SetupGuide = () => {
    // Safely get admin email even if process is undefined in browser
    const getAdminEmail = () => {
        try {
            // Use import.meta.env for Vite
            return import.meta.env.VITE_ADMIN_EMAIL || "hejustino@hjdconsulting.ca";
        }
        catch { return "hejustino@hjdconsulting.ca"; }
    };

    return (
        <div className="setup-guide">
            <h2 style={{ color: 'var(--primary-color)', marginTop: 0 }}>🛑 Database Access Blocked</h2>
            <p>Your Firebase database is missing the required Security Rules to allow this application to function.</p>

            <h3>1. Update Firestore Rules</h3>
            <p>Go to <strong>Firebase Console &gt; Firestore Database &gt; Rules</strong> and use this secure configuration:</p>
            <div className="setup-code">
                {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is the specific admin
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email_verified == true && 
             request.auth.token.email == '${getAdminEmail()}';
    }

    match /analyses/{analysisId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /transcripts/{transcriptId} {
      allow read, write: if isAdmin();
    }

    match /episode_comments/{episodeId} {
      allow read, write: if isAdmin();
    }

    match /processed_episodes/{videoId} {
      allow read, write: if isAdmin();
    }

    match /episode_sentiment/{episodeId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /balloon_data/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /contestants/{contestantId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /couples/{coupleId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}`}
            </div>

            <h3>2. Configure CORS for Storage (Optional)</h3>
            <p>We have moved to Firestore for transcript storage to avoid CORS issues, but if you use Cloud Storage for other assets:</p>
            <p style={{ fontSize: '0.9rem', color: '#888' }}>
                Use <code>gsutil cors set cors.json gs://balloon-87473.firebasestorage.app</code> via Google Cloud Shell.
            </p>

            <button className="analyze-btn" onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>
                I've Updated the Rules - Reload App
            </button>
        </div>
    )
};
