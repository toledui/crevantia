import { Brand } from './brand';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <Brand light />
        <div className="brand-message">
          <span className="eyebrow">Evaluación con propósito</span>
          <h1>Convierte cada evaluación en información útil para decidir.</h1>
          <p>Una experiencia clara, confidencial y diseñada para acompañar decisiones con mejor contexto.</p>
          <div className="value-list">
            <div><b>01</b><span><strong>Privacidad desde el diseño</strong><small>Tu información se protege en cada etapa.</small></span></div>
            <div><b>02</b><span><strong>Avance seguro</strong><small>Pausa y continúa sin perder tus respuestas.</small></span></div>
            <div><b>03</b><span><strong>Resultados trazables</strong><small>Cada reporte conserva sus versiones de origen.</small></span></div>
          </div>
        </div>
        <footer><span className="online-dot" /> Sistemas operando con normalidad <em>© 2026 Crevantia</em></footer>
      </section>
      <section className="form-panel">{children}</section>
    </main>
  );
}

