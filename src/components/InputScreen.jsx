import { useState, useCallback } from 'react';
import { usePlanStore } from '../context/PlanContext';
import { COUNTRY_OPTIONS } from '../data/holidays';

const INDUSTRIES = [
  'Healthcare',
  'Financial Services',
  'Retail',
  'Media',
  'Tech',
  'CPG',
  'Travel',
  'Other',
];

export default function InputScreen() {
  const { projectInputs, updateProjectInputs, nextStep } = usePlanStore();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [analyzingScreens, setAnalyzingScreens] = useState(false);
  const [screenAnalysisResult, setScreenAnalysisResult] = useState(null);

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file || !file.name.endsWith('.pdf')) {
        setUploadError('Please upload a PDF file');
        return;
      }
      setUploading(true);
      setUploadError('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        updateProjectInputs({
          rfpText: data.text || '',
          rfpFileName: file.name,
          description: data.summary || projectInputs.description,
          rfpSignals: data.signals || [],
        });
      } catch (err) {
        setUploadError(err.message || 'Failed to parse PDF');
      } finally {
        setUploading(false);
      }
    },
    [updateProjectInputs, projectInputs.description]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const analyzeForScreenCount = useCallback(
    async (method) => {
      const url = projectInputs.screenCountUrl;
      if (!url) return;
      setAnalyzingScreens(true);
      setScreenAnalysisResult(null);
      try {
        const endpoint = method === 'url' ? '/api/analyze-url' : '/api/analyze-app';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (data.aiAvailable === false) {
          setScreenAnalysisResult({ error: 'AI analysis requires ANTHROPIC_API_KEY' });
          return;
        }
        if (data.error) throw new Error(data.error);
        setScreenAnalysisResult(data);
        updateProjectInputs({
          screenCount: data.estimatedScreenCount || 0,
          screenCountConfirmed: false,
        });
      } catch (err) {
        setScreenAnalysisResult({ error: err.message });
      } finally {
        setAnalyzingScreens(false);
      }
    },
    [projectInputs.screenCountUrl, updateProjectInputs]
  );

  const canProceed =
    projectInputs.description.trim() &&
    projectInputs.startDate &&
    projectInputs.industry &&
    projectInputs.clientCountry;

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Project Details</h2>

      {/* Project Name */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
        <input
          type="text"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          placeholder="e.g., Acme Corp Website Redesign"
          value={projectInputs.projectName}
          onChange={(e) => updateProjectInputs({ projectName: e.target.value })}
        />
      </div>

      {/* Description */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Project Description <span className="text-amber-500">*</span>
        </label>
        <textarea
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[100px]"
          placeholder="Describe the project scope, goals, and key deliverables..."
          value={projectInputs.description}
          onChange={(e) => updateProjectInputs({ description: e.target.value })}
        />
      </div>

      {/* RFP Upload */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-300 mb-1">RFP Document (optional)</label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            uploading
              ? 'border-amber-500 bg-amber-500/5'
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('rfp-upload').click()}
        >
          <input
            id="rfp-upload"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
          />
          {uploading ? (
            <p className="text-amber-500">Parsing PDF...</p>
          ) : projectInputs.rfpFileName ? (
            <p className="text-teal-400">{projectInputs.rfpFileName} uploaded</p>
          ) : (
            <p className="text-slate-400">Drop PDF here or click to browse</p>
          )}
        </div>
        {uploadError && <p className="text-red-400 text-sm mt-1">{uploadError}</p>}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Start Date <span className="text-amber-500">*</span>
          </label>
          <input
            type="date"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
            value={projectInputs.startDate}
            onChange={(e) => updateProjectInputs({ startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Deadline (optional)</label>
          <input
            type="date"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
            value={projectInputs.deadline}
            onChange={(e) => updateProjectInputs({ deadline: e.target.value })}
          />
        </div>
      </div>

      {/* Industry & Country */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Industry <span className="text-amber-500">*</span>
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
            value={projectInputs.industry}
            onChange={(e) => updateProjectInputs({ industry: e.target.value })}
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Client Country <span className="text-amber-500">*</span>
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
            value={projectInputs.clientCountry}
            onChange={(e) => updateProjectInputs({ clientCountry: e.target.value })}
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Screen Count */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-300 mb-2">Screen Count</label>
        <div className="flex gap-2 mb-3">
          {['manual', 'url', 'app'].map((method) => (
            <button
              key={method}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                projectInputs.screenCountMethod === method
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => updateProjectInputs({ screenCountMethod: method })}
            >
              {method === 'manual' ? 'Manual' : method === 'url' ? 'Website URL' : 'App Store'}
            </button>
          ))}
        </div>

        {projectInputs.screenCountMethod === 'manual' ? (
          <input
            type="number"
            min="0"
            className="w-40 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
            placeholder="e.g., 25"
            value={projectInputs.screenCount || ''}
            onChange={(e) =>
              updateProjectInputs({
                screenCount: parseInt(e.target.value) || 0,
                screenCountConfirmed: true,
              })
            }
          />
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              placeholder={
                projectInputs.screenCountMethod === 'url'
                  ? 'https://example.com'
                  : 'App store URL...'
              }
              value={projectInputs.screenCountUrl}
              onChange={(e) => updateProjectInputs({ screenCountUrl: e.target.value })}
            />
            <button
              className="px-4 py-2.5 bg-teal-400 text-slate-900 rounded-lg font-medium hover:bg-teal-300 disabled:opacity-50"
              disabled={!projectInputs.screenCountUrl || analyzingScreens}
              onClick={() => analyzeForScreenCount(projectInputs.screenCountMethod)}
            >
              {analyzingScreens ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        )}

        {screenAnalysisResult && !screenAnalysisResult.error && (
          <div className="mt-3 bg-slate-800 rounded-lg p-4 border border-teal-400/30">
            <p className="text-teal-400 text-sm mb-2">
              Estimated: {screenAnalysisResult.estimatedScreenCount} screens
            </p>
            {screenAnalysisResult.breakdown && (
              <p className="text-slate-400 text-xs mb-2">{screenAnalysisResult.breakdown}</p>
            )}
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                className="w-24 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                value={projectInputs.screenCount || ''}
                onChange={(e) =>
                  updateProjectInputs({ screenCount: parseInt(e.target.value) || 0 })
                }
              />
              <button
                className="px-3 py-1.5 bg-teal-400 text-slate-900 rounded text-sm font-medium"
                onClick={() => updateProjectInputs({ screenCountConfirmed: true })}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
        {screenAnalysisResult?.error && (
          <p className="text-red-400 text-sm mt-2">{screenAnalysisResult.error}</p>
        )}
      </div>

      {/* Generate Plan button */}
      <button
        className="w-full py-3 bg-amber-500 text-slate-900 rounded-lg font-bold text-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        disabled={!canProceed}
        onClick={nextStep}
      >
        Generate Plan
      </button>
    </div>
  );
}
