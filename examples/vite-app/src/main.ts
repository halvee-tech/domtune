import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <nav class="nav"><strong>Northstar</strong><span>Real DOM fixture</span></nav>
  <section class="hero">
    <p>Activation workspace</p>
    <h1>Move with clarity.</h1>
    <article class="metric-card" data-domtune-source="examples/vite-app/src/style.css:43" aria-label="Activation metric card">
      <span>Activation rate</span>
      <strong>68.4%</strong>
      <small>+8.2% this week</small>
    </article>
  </section>
`;
