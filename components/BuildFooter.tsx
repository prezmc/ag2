'use client';

import { useState, useEffect } from 'react';

export default function BuildFooter() {
  const version = process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev';
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? '';
  const [dateDisplay, setDateDisplay] = useState('');

  useEffect(() => {
    if (!buildDate) {
      setDateDisplay('—');
      return;
    }
    setDateDisplay(
      new Date(buildDate).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    );
  }, [buildDate]);

  return (
    <footer className="build-footer">
      <span>Build v{version}</span>
      <span className="build-footer-sep">·</span>
      <span>{dateDisplay}</span>
    </footer>
  );
}
