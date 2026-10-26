import "./style.css";
import styles from "./metric.module.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <nav class="nav"><strong>Northstar</strong><span>Real DOM fixture</span></nav>
  <section class="hero">
    <p>Activation workspace</p>
    <h1>Move with clarity.</h1>
    <article class="metric-card" aria-label="Activation metric card">
      <span>Activation rate</span>
      <strong>68.4%</strong>
      <small>+8.2% this week</small>
    </article>
    <article class="${styles.moduleCard}" aria-label="Retention metric card">
      <span>Retention rate</span>
      <strong>81.7%</strong>
      <small>+3.4% this month</small>
    </article>
  </section>
`;
