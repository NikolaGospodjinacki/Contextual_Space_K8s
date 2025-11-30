import React, { useState } from 'react';

interface UsernameModalProps {
  onSubmit: (username: string) => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ onSubmit }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSubmit(username.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in border border-gray-700">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Contextual Space</h1>
          <p className="text-gray-400">Collaborate with notes in real-time</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter your name to get started
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name..."
            maxLength={20}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            autoFocus
          />
          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-teal-500 to-blue-500 text-white font-medium rounded-lg hover:from-teal-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Enter Space
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Your cursor and notes will be visible to others
        </p>
      </div>
    </div>
  );
};
