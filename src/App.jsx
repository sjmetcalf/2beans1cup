import { useEffect, useRef, useState } from "react";
import { useHashRoute, useBaristaCode } from "./hooks.js";
import { Badge } from "./Badge.jsx";
import { Grain } from "./bits.jsx";
import { Home } from "./pages/Home.jsx";
import { PourLog } from "./pages/PourLog.jsx";
import { SideBySide } from "./pages/SideBySide.jsx";
import { Menu } from "./pages/Menu.jsx";
import { Bar } from "./pages/Bar.jsx";
import { Barista } from "./pages/Barista.jsx";

const NAV = [
  { to: "/", label: "Cafe" },
  { to: "/menu", label: "The Menu" },
  { to: "/pour-log", label: "Pour Log" },
  { to: "/side-by-side", label: "Side by Side" },
  { to: "/bar", label: "Bar Station" },
];

const PAGES = {
  "/": Home,
  "/menu": Menu,
  "/pour-log": PourLog,
  "/side-by-side": SideBySide,
  "/bar": Bar,
  "/barista": Barista,
};

function Nav({ route }) {
  const listRef = useRef(null);
  const [pill, setPill] = useState(null);
  const code = useBaristaCode();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const place = () => {
      const el = listRef.current?.querySelector(`[data-to="${route}"]`);
      if (!el) return setPill(null);
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready?.then(place);
    return () => window.removeEventListener("resize", place);
  }, [route]);

  useEffect(() => setOpen(false), [route]);

  return (
    <header className="nav">
      <a href="#/" className="nav-brand" aria-label="2beans1cup home">
        <Badge size={40} spin={false} />
        <span className="wordmark">2beans<span className="wordmark-1">1</span>cup</span>
      </a>
      <button className="nav-toggle" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        <span /><span />
      </button>
      <nav className={`nav-links ${open ? "is-open" : ""}`} ref={listRef}>
        {pill && <span className="nav-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />}
        {NAV.map((n) => (
          <a key={n.to} href={`#${n.to}`} data-to={n.to} className={route === n.to ? "is-active" : ""}>
            {n.label}
          </a>
        ))}
        <a href="#/barista" data-to="/barista" className={`nav-barista ${route === "/barista" ? "is-active" : ""}`}>
          <span className={`dot ${code ? "dot-on" : ""}`} aria-hidden="true" />
          Barista
        </a>
      </nav>
    </header>
  );
}

export function App() {
  const [route] = useHashRoute();
  const Page = PAGES[route] || Home;
  return (
    <>
      <Grain />
      <Nav route={route} />
      <main className="page" key={route}>
        <Page />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <Badge size={72} spin={false} />
          <div>
            <p className="footer-title">2beans1cup</p>
            <p className="muted">Small-batch training for the Grand Traverse Triple Crown. Crested Butte ⇄ Aspen.</p>
          </div>
          <p className="muted footer-meta">Ski · Run · Bike · Espresso</p>
        </div>
      </footer>
    </>
  );
}
