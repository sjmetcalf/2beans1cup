import { useEffect, useRef, useState, useCallback } from "react";
import { onInvalidate, getCode } from "./api.js";

// Load async data; reloads when the cache is invalidated.
export function useData(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => onInvalidate(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    loader()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return state;
}

export function useInView(options = { threshold: 0.2 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect(); }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  return [ref, inView];
}

export function useBaristaCode() {
  const [code, setCodeState] = useState(getCode());
  useEffect(() => {
    const fn = () => setCodeState(getCode());
    window.addEventListener("barista-change", fn);
    return () => window.removeEventListener("barista-change", fn);
  }, []);
  return code;
}

export function useHashRoute() {
  const read = () => (window.location.hash.replace(/^#/, "") || "/").split("?")[0];
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const fn = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const go = useCallback((to) => { window.location.hash = to; }, []);
  return [route, go];
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}
