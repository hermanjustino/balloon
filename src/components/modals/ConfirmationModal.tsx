import React from 'react';

export const ConfirmationModal = ({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) => (
    <div className="modal-backdrop" onClick={onCancel}>
        <div className="modal-content confirmation-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{title}</h3>
            <p style={{ color: 'var(--text-muted-color)', marginBottom: '1.5rem' }}>{message}</p>
            <div className="modal-actions">
                <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="btn-danger" onClick={onConfirm}>Delete Data</button>
            </div>
        </div>
    </div>
);
