export const CSS = `
:root {
  --ink: #1b120c; --ink-2: #3a2a20; --paper: #fff8f0; --surface: #ffffff; --wash: #fff1e4;
  --line: #f0dccb; --ember: #ff5a1f; --solar: #ffb020; --success: #1f7a4d; --danger: #c03a2b; --muted: #7a6455;
  --radius: 20px; --shadow: 0 10px 30px rgba(27, 18, 12, .08);
  --font: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); color: var(--ink); background: radial-gradient(1200px 600px at 10% -10%, #ffe6cf 0%, var(--paper) 45%, #fff 100%); min-height: 100vh; }
a { color: var(--ink); }
.top { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.8); backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 5; }
.brand { font-weight: 800; letter-spacing: .08em; text-decoration: none; color: var(--ember); }
.top .chat { margin-left: auto; text-decoration: none; font-weight: 700; background: var(--ember); color: #fff; padding: 8px 14px; border-radius: 999px; }
.top a:last-child { text-decoration: none; color: var(--muted); }
main { max-width: 1080px; margin: 0 auto; padding: 24px 18px 80px; }
.page-head h1 { font-size: clamp(28px, 6vw, 44px); margin: 6px 0; letter-spacing: -.02em; }
.eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 12px; color: var(--muted); margin: 0; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); margin-bottom: 18px; }
.card.narrow { max-width: 460px; margin: 8vh auto; }
.stack { display: grid; gap: 10px; }
label { font-weight: 600; font-size: 14px; }
input, button { font: inherit; }
input { padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--wash); }
.btn { display: inline-block; border: 0; background: linear-gradient(135deg, var(--ember), var(--solar)); color: #fff; padding: 12px 18px; border-radius: 999px; font-weight: 800; cursor: pointer; text-decoration: none; text-align: center; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.error { color: var(--danger); font-weight: 600; }
.ok { color: var(--success); font-weight: 600; }
.month-nav { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.month-nav a { text-decoration: none; color: var(--muted); font-weight: 600; }
.dow, .month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.dow span { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); text-align: center; padding-bottom: 4px; }
.cell { min-height: 104px; border: 1px solid var(--line); border-radius: 12px; padding: 8px; background: var(--wash); text-decoration: none; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.cell.pad { background: transparent; border-style: dashed; }
.cell.today { outline: 2px solid var(--ember); outline-offset: -2px; background: #fff; }
.cell .date { font-weight: 800; font-size: 14px; }
.session { display: block; font-size: 11px; line-height: 1.25; padding: 3px 6px; border-radius: 7px; background: #fff; border: 1px solid var(--line); }
.session.kind-interval, .session.kind-tempo { border-color: var(--ember); color: var(--ember); }
.session.kind-long { border-color: var(--solar); }
.session.kind-rest { color: var(--muted); }
.done { font-size: 11px; color: var(--success); font-weight: 700; }
.sessions { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.sessions li { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--wash); }
.chip { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); }
.note { color: var(--ink-2); margin: 6px 0 0; }
.tick { color: var(--success); font-weight: 800; }
@media (max-width: 640px) {
  main { padding: 16px 10px 60px; }
  .cell { min-height: 78px; padding: 5px; }
  .session { font-size: 10px; padding: 2px 4px; }
  .top { padding: 10px 12px; gap: 8px; }
  .top .chat { padding: 7px 10px; font-size: 13px; }
}
@media print { .top, .month-nav, form, .btn { display: none; } }
`;
