export function InsightCard() {
  return (
    <article
      aria-label="React insight card"
      style={{
        width: "min(480px, 100%)",
        marginTop: 56,
        padding: 30,
        borderRadius: 26,
        background: "#f4eee2",
        boxShadow: "0 24px 64px rgb(54 43 24 / 12%)"
      }}
    >
      <span>Qualified pipeline</span>
      <strong>$4.8M</strong>
      <small>18 opportunities ready</small>
    </article>
  );
}
