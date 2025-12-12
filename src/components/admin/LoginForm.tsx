import React, { useState } from 'react';

type LoginFormProps = {
    onLogin: (email: string, pass: string) => Promise<any>;
    onGoogleLogin: () => Promise<any>;
};

export const LoginForm = ({ onLogin, onGoogleLogin }: LoginFormProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await onLogin(email, password);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        }
    };

    const handleGoogleClick = async () => {
        setError('');
        try {
            await onGoogleLogin();
        } catch (err: any) {
            console.error("Login Error Details:", err);
            // Check for specific Firebase auth domain error
            if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
                setError(`Configuration Error: This domain (${window.location.hostname}) is not authorized for Google Sign-In. Please add it in the Firebase Console > Authentication > Settings > Authorized Domains.`);
            } else if (err.code === 'auth/popup-closed-by-user') {
                setError(''); // User just closed the popup, no error needed
            } else {
                setError(err.message || 'Google login failed');
            }
        }
    };

    return (
        <div className="card input-card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
            <h2 className="card-title" style={{ textAlign: 'center' }}>Admin Login</h2>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleSubmit} className="login-form">
                <div className="form-field">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-field">
                    <label>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="analyze-btn" style={{ width: '100%', justifyContent: 'center' }}>Login</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0 0.5rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                <div style={{ padding: '0 10px', color: 'var(--text-muted-color)', fontSize: '0.85rem' }}>OR</div>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>
            <button type="button" className="google-btn" onClick={handleGoogleClick}>
                <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.734 42.379 C -8.804 40.449 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                    </g>
                </svg>
                Sign in with Google
            </button>
        </div>
    );
};
