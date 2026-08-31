import React from 'react';

interface InstructionsEditorProps {
  instructions: string;
  setInstructions: (val: string) => void;
  rules: string;
  setRules: (val: string) => void;
}

const InstructionsEditor: React.FC<InstructionsEditorProps> = ({ instructions, setInstructions, rules, setRules }) => {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="mb-2">
          <h3 className="text-lg font-bold text-dark">Welcome Instructions</h3>
          <p className="text-sm text-gray-500">This text will be shown to candidates immediately when they open the test link.</p>
        </div>
        <textarea 
          rows={5}
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
          placeholder="Welcome to the assessment! Please make sure you have a stable internet connection..."
        />
      </div>

      <div className="pt-6 border-t border-gray-100">
        <div className="mb-2">
          <h3 className="text-lg font-bold text-danger">Strict Rules & Disclaimers</h3>
          <p className="text-sm text-gray-500">These are the strict behavioral rules candidates must explicitly agree to before starting.</p>
        </div>
        <textarea 
          rows={6}
          value={rules || ''}
          onChange={e => setRules(e.target.value)}
          className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-red-50/30"
          placeholder="1. Do not exit full screen mode.&#10;2. Do not look away from the camera.&#10;3. External IDEs are strictly prohibited."
        />
      </div>
    </div>
  );
};

export default InstructionsEditor;
