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
    <article class="cascade-decoy mt-6 w-full max-w-[480px] rounded-[18px] bg-[#f6eadf] p-[26px] shadow-[0_18px_48px_rgb(25_44_34_/_9%)]" aria-label="Expansion metric card">
      <span class="font-mono text-[11px] font-bold uppercase tracking-[.1em] text-[#74675d]">Expansion rate</span>
      <strong class="my-[16px] block text-[52px] font-bold tracking-[-.05em]">124%</strong>
      <small class="font-bold text-[#9a5c2f]">+6.1% this quarter</small>
    </article>
  </section>
`;
