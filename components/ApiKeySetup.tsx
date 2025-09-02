import React, { useState, useEffect } from 'react';

interface ApiKeySetupProps {
  onKeyConfigured: () => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onKeyConfigured }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // Check if API key is already configured
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const validateApiKey = async (key: string): Promise<boolean> => {
    try {
      // Test the API key by making a simple request
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Gemini API key');
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      setError('Invalid API key format. Gemini API keys start with "AIza"');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const isValid = await validateApiKey(apiKey);
      
      if (!isValid) {
        setError('Invalid API key. Please check your key and try again.');
        setIsValidating(false);
        return;
      }

      // Store the API key securely in localStorage
      localStorage.setItem('gemini_api_key', apiKey);
      
      onKeyConfigured();
    } catch (error) {
      setError('Failed to validate API key. Please check your internet connection.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setError('');
  };

  const handleSkip = () => {
    // Allow users to skip if they want to use server-side key
    onKeyConfigured();
  };

  return (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700 max-w-2xl mx-auto">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-indigo-400 mb-2">Configure Gemini API Key</h2>
          <p className="text-gray-400">
            To use the Roundtable Meeting Agent, you need to provide your Google Gemini API key.
          </p>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-300 mb-2">How to get your API key:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a></li>
            <li>Sign in with your Google account</li>
            <li>Click "Create API Key"</li>
            <li>Copy the generated key and paste it below</li>
          </ol>
        </div>

        <div>
          <label htmlFor="apiKey" className="block text-lg font-medium text-indigo-300 mb-2">
            Gemini API Key
          </label>
          <div className="relative">
            <input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-3 px-4 pr-12 text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
            >
              {showKey ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <p className="text-sm text-yellow-200">
            <strong>Privacy Note:</strong> Your API key is stored locally in your browser and sent directly to Google's servers. 
            It is never stored on our servers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSaveKey}
            disabled={isValidating || !apiKey.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
          >
            {isValidating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Validating...
              </div>
            ) : (
              'Save & Continue'
            )}
          </button>
          
          {apiKey && (
            <button
              onClick={handleClearKey}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
            >
              Clear Key
            </button>
          )}
          
          <button
            onClick={handleSkip}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
          >
            Skip (Use Server Key)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySetup;