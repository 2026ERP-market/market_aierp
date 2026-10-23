import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/errors';
export function useAction() {
  const lock = useRef(false); const mounted = useRef(true);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string>(); const [failed, setFailed] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, []);
  async function run(action: () => Promise<unknown>, success: string) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setMessage(undefined); setFailed(false);
    try { await action(); if (mounted.current) setMessage(success); return mounted.current }
    catch (error) { if (mounted.current) { setMessage(errorMessage(error)); setFailed(true) } return false }
    finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  return { busy, message, failed, run };
}
