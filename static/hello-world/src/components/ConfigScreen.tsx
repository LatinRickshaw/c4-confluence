import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';

export function ConfigScreen() {
  const [pageId, setPageId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    view.getContext().then((context) => {
      const existing = context.extension?.config?.pageId;
      if (typeof existing === 'string') {
        setPageId(existing);
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = () => {
    void view.submit({ config: { pageId } });
  };

  const handleCancel = () => {
    void view.close();
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h4>Choose a diagram</h4>
      <p>Enter the Confluence page ID whose draw.io diagram this macro should display.</p>
      <input
        type="text"
        placeholder="Page ID"
        value={pageId}
        onChange={(e) => setPageId(e.target.value)}
        style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
      />
      <button onClick={handleSubmit} disabled={!pageId}>
        Save
      </button>
      <button onClick={handleCancel} style={{ marginLeft: 8 }}>
        Cancel
      </button>
    </div>
  );
}
