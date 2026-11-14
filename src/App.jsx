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
import { FreeTime } from "./pages/FreeTime.jsx";

const NAV = [
  { to: "/", label: "Cafe" },
  { to: "/menu", label: "The Menu" },
  { to: "/pour-log", label: "Pour Log" },
  { to: "/side-by-side", label: "Side by Side" },
  { to: "/bar", label: "Bar Station" },
];
const PRIVATE_NAV = [{ to: "/free-time", label: "Free Time" }];

const PAGES = {
  "/": Home,
  "/menu": Menu,
  "/pour-log": PourLog,
  "/side-by-side": SideBySide,
  "/bar": Bar,
  "/barista": Barista,
  "/free-time": FreeTime,
};

function Nav({ route }) {
  const listRef = useRef(null);
  const [pill, setPill] = useState(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const code = useBaristaCode();
  const items = [...NAV, ...(code ? PRIVATE_NAV : [])];

  useEffect(() => {
    const list = listRef.current;
    const place = () => {
      const el = list?.querySelector(`[data-to="${route}"]`);
      if (!el) return setPill(null);
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
      // keep the active tab in view on narrow screens
      if (list.scrollWidth > list.clientWidth) {
        const target = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2;
        list.scrollTo({ left: target, behavior: "smooth" });
      }
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready?.then(place);
    return () => window.removeEventListener("resize", place);
  }, [route, code]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => setEdges({ left: list.scrollLeft > 4, right: list.scrollLeft + list.clientWidth < list.scrollWidth - 4 });
    update();
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { list.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [code]);

  return (
    <header className="nav">
      <a href="#/" className="nav-brand" aria-label="2beans1cup home">
        <img className="nav-mark" src="/assets/beans-mark.webp" alt="" width="240" height="198" />
        <span className="wordmark">2beans<span className="wordmark-1">1</span>cup</span>
      </a>
      <div className={`nav-scroller ${edges.left ? "fade-left" : ""} ${edges.right ? "fade-right" : ""}`}>
        <nav className="nav-links" ref={listRef} aria-label="Sections">
          {pill && <span className="nav-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />}
          {items.map((n) => (
            <a key={n.to} href={`#${n.to}`} data-to={n.to} className={route === n.to ? "is-active" : ""} aria-current={route === n.to ? "page" : undefined}>
              {n.label}
            </a>
          ))}
          <a href="#/barista" data-to="/barista" className={`nav-barista ${route === "/barista" ? "is-active" : ""}`} aria-current={route === "/barista" ? "page" : undefined}>
            <span className={`dot ${code ? "dot-on" : ""}`} aria-hidden="true" />
            Barista
          </a>
        </nav>
      </div>
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
